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

const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const fail = (e: unknown) => ({ content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }], isError: true });
const safe = <A>(fn: (args: A) => Promise<unknown>) => async (args: A) => {
  try { return json(await fn(args)); } catch (e) { return fail(e); }
};
const read = { readOnlyHint: true };

export function buildMcpServer() {
  const server = new McpServer({ name: "sheerflow", version: "0.1.0" });

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

  server.registerTool("get_call_list", { description: "The call list (replaces the DFC sheet) with status, next step and gatekeeper/dead-number counts per company.", annotations: read, inputSchema: { owner_id: z.number().optional() } },
    safe(async ({ owner_id }) => (await core.listCallList({ ownerId: owner_id })).map((r) => ({
      queueId: r.entry.id, company: r.company.name, companyId: r.company.id, contact: r.person?.name, title: r.person?.title, owner: r.owner?.name, status: r.entry.status,
      topSignal: r.entry.topSignal, lastContact: r.entry.lastContactAt, nextStep: r.entry.nextStep, nextStepDate: r.entry.nextStepDate, dials: r.dials, gatekeeperOrDead: r.blocked, notes: r.entry.notes,
    }))));

  server.registerTool("get_kpis", { description: "Weekly funnel: dials, connects, meetings, agreements, placements, against targets.", annotations: read, inputSchema: { weeks: z.number().default(3) } },
    safe(async ({ weeks }) => ({ weeks: await core.getKpis({ weeks }), targets: await core.getSetting("kpi_targets") })));

  server.registerTool("list_jobs", { description: "Work the app has queued for Claude. Start a run by listing queued jobs, do each one, then call complete_job.", annotations: read, inputSchema: { status: z.enum(["queued", "in_progress", "done", "failed"]).default("queued") } },
    safe(async ({ status }) => core.listJobs({ status })));

  server.registerTool("search_talent_pool", { description: "Search past candidates by skill, stack, title or location.", annotations: read, inputSchema: { skill: z.string().optional() } },
    safe(async (a) => (await core.listTalentPool(a)).map((p) => ({ id: p.id, name: p.name, title: p.title, location: p.location, skills: p.skills }))));

  // ----- Write tools (append and dedupe only; nothing is sent or spent) -----
  server.registerTool("add_company", { description: "Add a company. If the domain already exists the existing record is returned unchanged.", inputSchema: { name: z.string(), domain: z.string(), industry: z.string().optional(), location: z.string().optional(), employees: z.number().optional(), icp_tier: z.enum(["A", "B", "C"]).optional(), icp_score: z.number().optional() } },
    safe(async (a) => core.upsertCompany({ name: a.name, domain: a.domain, industry: a.industry, location: a.location, employees: a.employees, icpTier: a.icp_tier, icpScore: a.icp_score })));

  server.registerTool("add_signal", {
    description: "Record a reason to act now. Deduped on external_id (for LinkedIn posts, the Post ID); duplicates are skipped.",
    inputSchema: { type: z.enum(["hiring_post", "job_posting", "new_leader", "funding", "job_alert", "staffing_intent"]), title: z.string(), summary: z.string().optional(), roles: z.string().optional(), category: z.string().optional(), company_name: z.string().optional(), company_domain: z.string().optional(), source: z.string(), source_url: z.string().optional(), external_id: z.string().optional(), signal_date: z.string().optional() },
  }, safe(async (a) => core.addSignal({ type: a.type, title: a.title, summary: a.summary, roles: a.roles, category: a.category, companyName: a.company_name, companyDomain: a.company_domain, source: a.source, sourceUrl: a.source_url, externalId: a.external_id, signalDate: a.signal_date })));

  server.registerTool("add_to_call_list", { description: "Put a company on the call list. Skipped if it is already there or marked do-not-contact.", inputSchema: { company_id: z.number(), top_signal: z.string().optional(), person_id: z.number().optional() } },
    safe(async (a) => core.addToCallList(a.company_id, { topSignal: a.top_signal, personId: a.person_id, addedBy: "Claude" })));

  server.registerTool("log_call", { description: "Log a call outcome against a call-list row.", inputSchema: { queue_id: z.number(), outcome: z.enum(["connected", "voicemail", "gatekeeper", "no_answer", "dead_number", "do_not_contact", "meeting_booked"]), notes: z.string().optional(), next_step: z.string().optional(), next_step_date: z.string().optional() } },
    safe(async (a) => core.logCall({ queueId: a.queue_id, outcome: a.outcome, notes: a.notes, nextStep: a.next_step, nextStepDate: a.next_step_date })));

  server.registerTool("queue_connection", { description: "Tick Connect? for a person. Does not contact anyone; it only queues a note to be written.", inputSchema: { person_id: z.number() } },
    safe(async (a) => core.queueConnection(a.person_id)));

  server.registerTool("draft_note", { description: "Save a LinkedIn connection note (max 300 characters) for a person. A human copies it and sends the request by hand.", inputSchema: { person_id: z.number(), note: z.string() } },
    safe(async (a) => core.saveConnectionNote(a.person_id, a.note)));

  server.registerTool("save_draft", { description: "Save an email draft for review. It is never sent from here.", inputSchema: { kind: z.enum(["cold_email", "follow_up"]), person_id: z.number().optional(), company_id: z.number().optional(), subject: z.string(), body: z.string() } },
    safe(async (a) => core.saveDraft({ kind: a.kind, personId: a.person_id, companyId: a.company_id, subject: a.subject, body: a.body })));

  server.registerTool("add_task", { description: "Add a task for a person on the team.", inputSchema: { title: z.string(), owner_id: z.number().optional(), company_id: z.number().optional(), due_date: z.string().optional() } },
    safe(async (a) => core.addTask({ title: a.title, ownerId: a.owner_id, companyId: a.company_id, dueDate: a.due_date })));

  server.registerTool("record_apollo_credits", { description: "Record the current Apollo credit balance and what the run spent it on. Call after any run that used Apollo, with the balance Apollo reports.", inputSchema: { balance: z.number(), reason: z.string() } },
    safe(async (a) => core.recordCredits(a)));

  server.registerTool("import_companies", {
    description: "Add companies found elsewhere (for example through the Apollo connector). Deduped on domain: known companies are skipped, never overwritten.",
    inputSchema: { companies: z.array(z.object({ name: z.string(), domain: z.string(), industry: z.string().optional(), location: z.string().optional(), employees: z.number().optional(), phone: z.string().optional(), apollo_id: z.string().optional() })).max(200) },
  }, safe(async (a) => core.importCompanies(a.companies.map((c) => ({ ...c, apolloId: c.apollo_id })))));

  server.registerTool("complete_job", { description: "Mark a queued job done (or failed) with a short result summary.", inputSchema: { job_id: z.number(), result: z.string(), failed: z.boolean().default(false) } },
    safe(async (a) => core.completeJob(a.job_id, a.result, a.failed)));

  return server;
}
