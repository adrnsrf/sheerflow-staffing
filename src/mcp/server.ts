/**
 * The platform as a tool for Claude. Claude (Duet, Cowork or Claude Code) connects to
 * /api/mcp and calls these tools; the app never calls Claude. Every tool is a thin
 * wrapper around src/core, the same functions the screens use.
 *
 * Ground rules built in: nothing here sends email, sends a LinkedIn request or spends
 * Apollo credits. Claude can read, draft and queue; a person presses the button.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as core from "@/core";
import { getNextActions } from "@/core/decisions";
import * as imports from "@/core/imports";
import * as signals from "@/core/signals";
import { getCandidateActions } from "@/core/candidate-actions";
import * as candidates from "@/core/candidates";
import * as context from "@/core/context";
import * as matching from "@/core/matching";
import { addPhone } from "@/core/phones";
import * as staffing from "@/core/staffing";

const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const fail = (e: unknown) => ({ content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }], isError: true });
const safe = <A>(fn: (args: A) => Promise<unknown>) => async (args: A) => {
  try { return json(await fn(args)); } catch (e) { return fail(e); }
};
const read = { readOnlyHint: true };

export function buildMcpServer() {
  const server = new McpServer({ name: "sheerflow", version: "0.2.0" }, {
    instructions: "SheerFlow is a staffing business app. Before doing any work, call get_context with slug 'ground-rules'. list_context shows the other skills and routines; read the ones that fit the task. Nothing here sends email, contacts anyone on LinkedIn or spends Apollo credits.",
  });

  // ----- Read tools -----
  server.registerTool("get_overview", { description: "Counts of what needs attention today: new signals, calls due, connection notes waiting, queued jobs, drafts, tasks, Apollo credits.", annotations: read },
    safe(async () => core.getOverview()));

  server.registerTool("find_new_signals", {
    description: "List signals (hiring posts, job postings, new data leaders, funding) ranked by ICP fit and freshness.", annotations: read,
    inputSchema: { status: z.enum(["new", "kept", "dismissed", "promoted"]).default("new"), since_days: z.number().optional(), limit: z.number().default(20) },
  }, safe(async ({ status, since_days, limit }) => (await core.listSignals({ status, sinceDays: since_days, limit })).map((r) => ({
    id: r.signal.id, type: r.signal.type, category: r.signal.category, title: r.signal.title, summary: r.signal.summary, date: r.signal.signalDate, source: r.signal.source, url: r.signal.sourceUrl,
    company: r.company && { id: r.company.id, name: r.company.name, domain: r.company.domain, icpTier: r.company.icpTier, icpScore: r.company.icpScore }, person: r.person && { id: r.person.id, name: r.person.name, title: r.person.title },
  }))));

  server.registerTool("search_companies", { description: "Find companies by name or domain, optionally by ICP tier.", annotations: read, inputSchema: { search: z.string().optional(), tier: z.enum(["A", "B", "C"]).optional() } },
    safe(async (a) => (await core.listCompanies(a)).map((c) => ({ id: c.id, name: c.name, domain: c.domain, industry: c.industry, location: c.location, employees: c.employees, icpTier: c.icpTier, icpScore: c.icpScore, status: c.status }))));

  server.registerTool("get_account", { description: "Everything on one company: brief, people, signals, past touches, call-list row, deals and searches.", annotations: read, inputSchema: { company_id: z.number() } },
    safe(async ({ company_id }) => (await core.getAccount(company_id)) ?? Promise.reject(new Error(`No company with id ${company_id}`))));

  server.registerTool("get_call_list", { description: "The call list (replaces the DFC sheet) with status, next step, and every phone number for the row with its source and call history.", annotations: read, inputSchema: { owner_id: z.number().optional() } },
    safe(async ({ owner_id }) => (await core.listCallList({ ownerId: owner_id })).map((r) => ({
      queueId: r.entry.id, company: r.company.name, companyId: r.company.id, contact: r.person?.name, title: r.person?.title, owner: r.owner?.name, status: r.entry.status,
      topSignal: r.entry.topSignal, lastContact: r.entry.lastContactAt, nextStep: r.entry.nextStep, nextStepDate: r.entry.nextStepDate,
      phones: r.phones.map((p) => ({ id: p.id, number: p.number, kind: p.kind, label: p.label, source: p.source, status: p.status, dials: p.dials, bad: p.bad, gatekeeper: p.gatekeeper, reached: p.reached })),
    }))));

  server.registerTool("get_kpis", { description: "Weekly funnel: dials, connects, meetings, agreements, placements, against targets.", annotations: read, inputSchema: { weeks: z.number().default(3) } },
    safe(async ({ weeks }) => ({ weeks: await core.getKpis({ weeks }), targets: await core.getSetting("kpi_targets") })));

  server.registerTool("list_jobs", { description: "Work the app has queued for Claude. Start a run by listing queued jobs, do each one, then call complete_job.", annotations: read, inputSchema: { status: z.enum(["queued", "in_progress", "done", "failed"]).default("queued") } },
    safe(async ({ status }) => core.listJobs({ status })));

  // ----- Candidates and roles -----
  server.registerTool("search_candidates", { description: "Vector search over candidate profiles. Describe who you need in plain words; returns the closest profiles with their top tools and years.", annotations: read, inputSchema: { query: z.string(), limit: z.number().default(10) } },
    safe(async (a) => {
      const all = new Map((await candidates.listCandidates()).map((c) => [c.person.id, c]));
      return (await matching.searchCandidates(a.query, a.limit)).map((h) => { const c = all.get(h.personId)!; return { id: h.personId, name: c.person.name, headline: c.cp.profile.headline, similarity: h.similarity, matchedOn: h.matchedOn, snippet: h.snippet, toolHits: h.toolHits, knownPercent: c.cp.completeness }; });
    }));

  server.registerTool("get_candidate", { description: "One candidate: the structured profile, every raw source it was compiled from (with whether each is compiled yet), and what is still missing.", annotations: read, inputSchema: { person_id: z.number() } },
    safe(async (a) => { const c = await candidates.getCandidate(a.person_id); if (!c) throw new Error(`No candidate with id ${a.person_id}`); return { id: c.person.id, name: c.person.name, linkedin: c.person.linkedinUrl, profile: c.profile, missing: c.check.missing, knownPercent: c.check.score, sources: c.sources.map((x) => ({ id: x.id, kind: x.kind, title: x.title, received: x.receivedAt, compiled: !!x.compiledAt, content: x.content })) }; }));

  server.registerTool("add_candidate", { description: "Add a candidate (or find the existing one by LinkedIn URL). Returns the person id.", inputSchema: { name: z.string(), linkedin_url: z.string().optional(), email: z.string().optional() } },
    safe(async (a) => ({ personId: await candidates.createCandidate({ name: a.name, linkedinUrl: a.linkedin_url, email: a.email }) })));

  server.registerTool("add_candidate_source", { description: "Store raw material about a candidate exactly as received: a resume, application answers, a screen-call transcript, messages. Kept for tracing facts back; does not change the profile.", inputSchema: { person_id: z.number(), kind: z.enum(["linkedin", "resume", "application", "screen_call", "conversation", "recruiter_note"]), title: z.string().optional(), content: z.string() } },
    safe(async (a) => { const src = await candidates.addCandidateSource({ personId: a.person_id, kind: a.kind, title: a.title, content: a.content, queue: false }); return { sourceId: src.id }; }));

  server.registerTool("save_candidate_profile", { description: "Save a candidate's compiled profile (the whole structured document; see the compiling-candidate-profiles skill for the shape). Replaces the previous profile, marks the candidate's sources as compiled, and rebuilds the search vector. Rejected if it does not fit the schema.", inputSchema: { person_id: z.number(), profile: z.record(z.string(), z.unknown()) } },
    safe(async (a) => candidates.saveCandidateProfile(a.person_id, a.profile, { markSourcesCompiled: true })));

  const scale = z.object({ value: z.number().min(1).max(5), evidence: z.string().optional(), source: z.enum(["linkedin", "resume", "application", "screen_call", "conversation", "recruiter_note"]).optional(), confidence: z.enum(["stated", "inferred"]).optional() }).nullable();
  server.registerTool("update_candidate_personality", {
    description: "Set some of a candidate's personality scales (1 to 5; see the compiling-candidate-profiles skill for what each end means) without rewriting the rest of the profile. Give evidence for each. Pass null to clear a scale. Only set what a source actually supports.",
    inputSchema: { person_id: z.number(), dimensions: z.object({ scope: scale, structure: scale, pace: scale, demeanor: scale, confidence: scale, teamwork: scale, audience: scale, leadership: scale }).partial().optional(), interests: z.array(z.string()).optional(), notes: z.string().optional() },
  }, safe(async (a) => candidates.updatePersonality(a.person_id, { dimensions: a.dimensions, interests: a.interests, notes: a.notes })));

  server.registerTool("get_candidate_actions", {
    description: "What to do next on the candidate side for open roles: who to reach out to, nudge, screen, check on or submit, each with the reason and a ready-to-send first message. Nothing here contacts anyone.", annotations: read,
    inputSchema: { limit: z.number().default(15), role_id: z.number().optional() },
  }, safe(async (a) => (await getCandidateActions({ limit: a.limit, searchId: a.role_id })).map((x) => ({ action: x.headline, kind: x.kind, when: x.when, why: x.why, candidate: { id: x.person.id, name: x.person.name, linkedin: x.person.linkedinUrl, hasEmail: !!x.person.email, hasPhone: !!x.person.phone, agreedToAiCall: x.person.aiContactConsent }, role: x.role, firstMessage: x.feeler?.message }))));

  server.registerTool("list_roles", { description: "The open roles being filled, each with its requirements.", annotations: read },
    safe(async () => { await candidates.candidatesReady(); return (await core.listSearches()).map((r) => ({ id: r.search.id, title: r.search.title, client: r.client, status: r.search.status, requirements: r.search.requirements, pipeline: r.stages })); }));

  server.registerTool("match_role", { description: "Rank candidates for a saved role. Each match has an overall score, a requirements score, a similarity score, years per required tool, and the reasons.", annotations: read, inputSchema: { role_id: z.number(), limit: z.number().default(10) } },
    safe(async (a) => (await matching.matchRole(a.role_id, a.limit)).map((m) => ({ id: m.personId, name: m.name, headline: m.headline, score: m.score, requirements: m.structured, similarity: m.similarity, missingMustHaves: m.missingMust, tools: m.tools, reasons: m.parts.map((p) => `${p.label}: ${p.note}`) }))));

  server.registerTool("match_job_description", { description: "Rank candidates against any job description text without saving it. Also returns the requirements the app read from the text.", annotations: read, inputSchema: { text: z.string(), limit: z.number().default(10) } },
    safe(async (a) => { const r = await matching.matchText(a.text, a.limit); return { requirementsRead: r.requirements, matches: r.matches.map((m) => ({ id: m.personId, name: m.name, score: m.score, requirements: m.structured, similarity: m.similarity, missingMustHaves: m.missingMust, reasons: m.parts.map((p) => `${p.label}: ${p.note}`) })) }; }));

  server.registerTool("save_role", { description: "Create or update a role from a job description. Pass requirements to set them exactly (tools with minYears and must, minTotalYears, companySize, workplace, city, state, maxBase); otherwise they are read from the text.", inputSchema: { id: z.number().optional(), title: z.string(), client_name: z.string().optional(), description: z.string(), requirements: z.record(z.string(), z.unknown()).optional() } },
    safe(async (a) => ({ roleId: await matching.saveRole({ id: a.id, title: a.title, clientName: a.client_name, description: a.description, requirements: a.requirements as never }) })));

  // ----- Write tools (append and dedupe only; nothing is sent or spent) -----
  server.registerTool("add_company", { description: "Add a company. If the domain already exists the existing record is returned unchanged.", inputSchema: { name: z.string(), domain: z.string(), industry: z.string().optional(), location: z.string().optional(), employees: z.number().optional(), icp_tier: z.enum(["A", "B", "C"]).optional(), icp_score: z.number().optional() } },
    safe(async (a) => core.upsertCompany({ name: a.name, domain: a.domain, industry: a.industry, location: a.location, employees: a.employees, icpTier: a.icp_tier, icpScore: a.icp_score })));

  server.registerTool("add_signal", {
    description: "Record a reason to act now. Deduped on external_id (for LinkedIn posts, the Post ID); duplicates are skipped.",
    inputSchema: { type: z.enum(["hiring_post", "job_posting", "new_leader", "funding", "job_alert", "staffing_intent"]), title: z.string(), summary: z.string().optional(), roles: z.string().optional(), category: z.string().optional(), company_name: z.string().optional(), company_domain: z.string().optional(), source: z.string(), source_url: z.string().optional(), external_id: z.string().optional(), signal_date: z.string().optional() },
  }, safe(async (a) => core.addSignal({ type: a.type, title: a.title, summary: a.summary, roles: a.roles, category: a.category, companyName: a.company_name, companyDomain: a.company_domain, source: a.source, sourceUrl: a.source_url, externalId: a.external_id, signalDate: a.signal_date })));

  server.registerTool("add_to_call_list", { description: "Put a company on the call list. Skipped if it is already there or marked do-not-contact.", inputSchema: { company_id: z.number(), top_signal: z.string().optional(), person_id: z.number().optional() } },
    safe(async (a) => core.addToCallList(a.company_id, { topSignal: a.top_signal, personId: a.person_id, addedBy: "Claude" })));

  server.registerTool("log_call", { description: "Log one dial against a call-list row and the number dialed. The row's status follows from the outcome (see the call-outcomes skill).", inputSchema: { queue_id: z.number(), outcome: z.enum(["connected", "meeting_booked", "email_requested", "voicemail", "no_answer", "gatekeeper", "bad_number", "wrong_person", "not_interested", "do_not_contact"]), phone_number_id: z.number().optional(), notes: z.string().optional(), next_step: z.string().optional(), next_step_date: z.string().optional() } },
    safe(async (a) => core.logCall({ queueId: a.queue_id, outcome: a.outcome, phoneNumberId: a.phone_number_id, notes: a.notes, nextStep: a.next_step, nextStepDate: a.next_step_date })));

  server.registerTool("queue_connection", { description: "Tick Connect? for a person. Does not contact anyone; it only queues a note to be written.", inputSchema: { person_id: z.number() } },
    safe(async (a) => core.queueConnection(a.person_id)));

  server.registerTool("draft_note", { description: "Save a LinkedIn connection note (max 300 characters) for a person. A human copies it and sends the request by hand.", inputSchema: { person_id: z.number(), note: z.string() } },
    safe(async (a) => core.saveConnectionNote(a.person_id, a.note)));

  server.registerTool("save_draft", { description: "Save an email or LinkedIn message draft for review. It is never sent from here.", inputSchema: { kind: z.enum(["cold_email", "follow_up", "linkedin_message"]), person_id: z.number().optional(), company_id: z.number().optional(), subject: z.string(), body: z.string() } },
    safe(async (a) => core.saveDraft({ kind: a.kind, personId: a.person_id, companyId: a.company_id, subject: a.subject, body: a.body })));

  server.registerTool("add_task", { description: "Add a task for a person on the team.", inputSchema: { title: z.string(), owner_id: z.number().optional(), company_id: z.number().optional(), due_date: z.string().optional() } },
    safe(async (a) => core.addTask({ title: a.title, ownerId: a.owner_id, companyId: a.company_id, dueDate: a.due_date })));

  server.registerTool("record_apollo_credits", { description: "Record the current Apollo credit balance and what the run spent it on. Call after any run that used Apollo, with the balance Apollo reports.", inputSchema: { balance: z.number(), reason: z.string() } },
    safe(async (a) => core.recordCredits(a)));

  server.registerTool("import_companies", {
    description: "Add companies found elsewhere (for example through the Apollo connector). Deduped on domain: known companies are skipped, never overwritten.",
    inputSchema: { companies: z.array(z.object({ name: z.string(), domain: z.string(), industry: z.string().optional(), location: z.string().optional(), employees: z.number().optional(), phone: z.string().optional(), apollo_id: z.string().optional() })).max(200) },
  }, safe(async (a) => core.importCompanies(a.companies.map((c) => ({ ...c, apolloId: c.apollo_id })))));

  const rowsSchema = z.array(z.record(z.string(), z.string())).max(100);
  server.registerTool("import_call_sheet_rows", { description: "Import rows of the DFC call sheet, each an object keyed by the sheet's header text (Company, Name, Call Status, DFC Notes, ...). Safe to repeat: unchanged rows are skipped. Up to 100 rows per call.", inputSchema: { rows: rowsSchema } },
    safe(async (a) => imports.importCallSheet(a.rows)));

  server.registerTool("import_hiring_posts", { description: "Import rows of the LinkedIn hiring posts sheet, keyed by header text (Post ID, Post Date, Category, Poster Name, ...). Deduped on Post ID. Up to 100 rows per call.", inputSchema: { rows: rowsSchema } },
    safe(async (a) => imports.importHiringPosts(a.rows)));

  server.registerTool("add_job_alert_email", { description: "Hand over one LinkedIn job alert email (plain-text body) and the app extracts and stores the jobs in it. Deduped on LinkedIn job id; jobs from staffing firms and job boards are dropped.", inputSchema: { body: z.string(), subject: z.string().optional(), thread_id: z.string().optional(), received_at: z.string().optional() } },
    safe(async (a) => imports.importJobAlerts(imports.parseJobAlertEmail(a.body, { subject: a.subject, threadId: a.thread_id, receivedAt: a.received_at }))));

  server.registerTool("list_job_postings", { description: "Jobs collected from LinkedIn job alert emails.", annotations: read, inputSchema: { status: z.enum(["new", "kept", "dismissed"]).default("new") } },
    safe(async (a) => (await imports.listJobPostings({ status: a.status })).map(({ job, company }) => ({ id: job.id, title: job.title, company: job.companyName, account: company?.id, location: job.location, url: job.url, received: job.receivedAt }))));

  server.registerTool("mark_connected", { description: "Record that a LinkedIn connection request was accepted (for example after reading an acceptance email). Does not touch LinkedIn.", inputSchema: { person_id: z.number() } },
    safe(async (a) => core.setConnectionStatus(a.person_id, "connected")));

  server.registerTool("search_people", { description: "Find decision makers by name, title or company, optionally by LinkedIn connection status.", annotations: read, inputSchema: { search: z.string().optional(), connection: z.enum(["none", "queued", "note_ready", "sent", "connected"]).optional() } },
    safe(async (a) => (await core.listPeople({ search: a.search, connection: a.connection, limit: 50 })).map(({ person: p, company }) => ({ id: p.id, name: p.name, title: p.title, company: company?.name, linkedin: p.linkedinUrl, connection: p.connectionStatus, note: p.connectionNote }))));

  server.registerTool("get_next_actions", {
    description: "The ranked list of what Adrian should do next and why: who to connect with, message, call or add to the call list. Each action names the rule and the signals behind it.", annotations: read,
    inputSchema: { limit: z.number().default(15), kind: z.enum(["follow_up", "message", "send_request", "connect", "call", "add_to_call_list", "research", "find_contact"]).optional() },
  }, safe(async (a) => (await getNextActions({ limit: a.limit, kind: a.kind })).map((x) => ({ action: x.headline, kind: x.kind, when: x.when, score: x.score, why: x.why, company: x.company, person: x.person && { id: x.person.id, name: x.person.name, title: x.person.title, linkedin: x.person.linkedinUrl }, queueId: x.queueId }))));

  server.registerTool("get_signals", { description: "Every scored signal for one company (its own and its people's), strongest first, with the company's heat, fit and priority.", annotations: read, inputSchema: { company_id: z.number() } },
    safe(async (a) => ({ heat: await signals.companyHeat(a.company_id), signals: (await signals.companySignals(a.company_id)).map((f) => ({ type: f.type_label, level: f.level, title: f.title, detail: f.detail, source: f.source, date: f.occurred_at, score: f.score, url: f.url })) })));

  server.registerTool("add_apollo_intent", { description: "Record Apollo buying-intent readings (company level) for one of our topics. One reading per company, topic and day; staffing firms are skipped.", inputSchema: { readings: z.array(z.object({ company_name: z.string(), domain: z.string().optional(), apollo_id: z.string().optional(), topic: z.string(), level: z.enum(["high", "medium", "low"]), observed_at: z.string().optional() })).max(200) } },
    safe(async (a) => signals.addApolloIntent(a.readings.map((r) => ({ companyName: r.company_name, domain: r.domain, apolloId: r.apollo_id, topic: r.topic, level: r.level, observedAt: r.observed_at })))));

  server.registerTool("add_apollo_job_postings", { description: "Record data roles Apollo shows as open at a company we already have (company level). Deduped on Apollo's posting id.", inputSchema: { postings: z.array(z.object({ company_id: z.number(), title: z.string(), location: z.string().optional(), url: z.string().optional(), posted_at: z.string().optional(), apollo_posting_id: z.string().optional() })).max(200) } },
    safe(async (a) => signals.addApolloJobPostings(a.postings.map((p) => ({ companyId: p.company_id, title: p.title, location: p.location, url: p.url, postedAt: p.posted_at, apolloPostingId: p.apollo_posting_id })))));

  server.registerTool("list_context", { description: "The AI context store: skills (standing guidance) and routines (jobs that can be queued), with a one-line summary of each.", annotations: read },
    safe(async () => (await context.listContext()).map(({ slug, kind, title, schedule, summary }) => ({ slug, kind, title, schedule, summary }))));

  server.registerTool("get_context", { description: "The full text of one skill or routine. Read 'ground-rules' first, and a routine's instructions before working a job whose kind starts with 'routine:'.", annotations: read, inputSchema: { slug: z.string() } },
    safe(async (a) => (await context.getContext(a.slug)) ?? Promise.reject(new Error(`No context doc named ${a.slug}`))));

  server.registerTool("check_staffing_firms", { description: "Check company names against the staffing archive. Returns which are staffing firms, recruiters or job boards (never prospects).", inputSchema: { names: z.array(z.string()).max(200) } },
    safe(async (a) => staffing.checkStaffingNames(a.names, "Claude check")));

  server.registerTool("add_staffing_firm", { description: "Add a confirmed staffing firm, recruiter or job board to the archive, with a one-line reason.", inputSchema: { name: z.string(), domain: z.string().optional(), note: z.string().optional() } },
    safe(async (a) => staffing.addStaffingFirm({ name: a.name, domain: a.domain, note: a.note, status: "confirmed", source: "Claude research" })));

  server.registerTool("add_phone_number", { description: "Save a researched phone number for a company (or one of its people) with where it was found. Skipped if already on file.", inputSchema: { company_id: z.number(), person_id: z.number().optional(), number: z.string(), label: z.string().optional(), source: z.enum(["apollo", "claude_research"]), source_detail: z.string().optional() } },
    safe(async (a) => (await addPhone({ companyId: a.company_id, personId: a.person_id, number: a.number, label: a.label, source: a.source, sourceDetail: a.source_detail })) ?? Promise.reject(new Error("That does not look like a phone number"))));

  server.registerTool("complete_job", { description: "Mark a queued job done (or failed) with a short result summary.", inputSchema: { job_id: z.number(), result: z.string(), failed: z.boolean().default(false) } },
    safe(async (a) => core.completeJob(a.job_id, a.result, a.failed)));

  return server;
}
