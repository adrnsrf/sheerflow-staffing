/**
 * The logic layer. Screens (server actions) and Claude (MCP tools) both call these
 * functions, so a rule such as "dedupe companies on domain" lives in exactly one place.
 */
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";

const DAY = 86_400_000;

// ---------- Companies and people ----------

export function normalizeDomain(input: string | null | undefined) {
  const d = (input ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  return d.includes(".") ? d : null;
}

/** One canonical form for profile links, so the same person always matches: https://www.linkedin.com/in/slug */
export function normalizeLinkedIn(input: string | null | undefined) {
  const m = (input ?? "").trim().match(/linkedin\.com\/(in|pub)\/([^/?#\s]+)/i);
  return m ? `https://www.linkedin.com/in/${decodeURIComponent(m[2]).toLowerCase()}` : null;
}

/** Add a company, or return the existing one when the domain is already known. */
export type CompanyInput = Partial<typeof s.companies.$inferInsert> & { name: string };

/**
 * Add a company, or return the one we already have. Matches on domain; a company that
 * arrives without a website matches on exact name. An existing record is never overwritten:
 * only fields that are still blank are filled in.
 */
export async function upsertCompany(input: CompanyInput) {
  const db = await getDb();
  const domain = normalizeDomain(input.domain ?? input.website);
  const name = input.name.trim();
  const [existing] = domain
    ? await db.select().from(s.companies).where(eq(s.companies.domain, domain))
    : await db.select().from(s.companies).where(sql`lower(${s.companies.name}) = ${name.toLowerCase()}`).limit(1);
  if (existing) {
    const fill = Object.fromEntries(Object.entries(input).filter(([k, v]) => v != null && v !== "" && (existing as Record<string, unknown>)[k] == null));
    if (Object.keys(fill).length === 0) return { company: existing, created: false };
    const [company] = await db.update(s.companies).set(fill).where(eq(s.companies.id, existing.id)).returning();
    return { company, created: false };
  }
  const [company] = await db.insert(s.companies).values({ ...input, name, domain, website: input.website ?? (domain ? `https://${domain}` : null) }).returning();
  return { company, created: true };
}

export type PersonInput = Partial<typeof s.people.$inferInsert> & { name: string };

/** Add a person, or return the one we already have (LinkedIn URL first, then Apollo id). Blank fields are filled; nothing is overwritten. */
export async function upsertPerson(input: PersonInput) {
  const db = await getDb();
  const linkedinUrl = normalizeLinkedIn(input.linkedinUrl);
  let existing = linkedinUrl ? (await db.select().from(s.people).where(eq(s.people.linkedinUrl, linkedinUrl)))[0] : undefined;
  if (!existing && input.apolloId) existing = (await db.select().from(s.people).where(eq(s.people.apolloId, input.apolloId)).limit(1))[0];
  if (!existing && !linkedinUrl && !input.apolloId && input.companyId) {
    existing = (await db.select().from(s.people).where(and(eq(s.people.companyId, input.companyId), sql`lower(${s.people.name}) = ${input.name.trim().toLowerCase()}`)).limit(1))[0];
  }
  if (existing) {
    const fill = Object.fromEntries(Object.entries({ ...input, linkedinUrl }).filter(([k, v]) => v != null && v !== "" && (existing as Record<string, unknown>)[k] == null));
    if (Object.keys(fill).length === 0) return { person: existing, created: false };
    const [person] = await db.update(s.people).set(fill).where(eq(s.people.id, existing.id)).returning();
    return { person, created: false };
  }
  const [person] = await db.insert(s.people).values({ type: "decision_maker", ...input, name: input.name.trim(), linkedinUrl }).returning();
  return { person, created: true };
}

export async function listCompanies(opts: { search?: string; tier?: string } = {}) {
  const db = await getDb();
  const rows = await db.select().from(s.companies).orderBy(desc(s.companies.icpScore));
  const q = opts.search?.toLowerCase();
  return rows.filter((c) => (!q || c.name.toLowerCase().includes(q) || (c.domain ?? "").includes(q)) && (!opts.tier || c.icpTier === opts.tier));
}

export async function getAccount(companyId: number) {
  const db = await getDb();
  const [company] = await db.select().from(s.companies).where(eq(s.companies.id, companyId));
  if (!company) return null;
  const [people, signals, activities, queue, deals, searches] = await Promise.all([
    db.select().from(s.people).where(and(eq(s.people.companyId, companyId), eq(s.people.type, "decision_maker"))),
    db.select().from(s.signals).where(eq(s.signals.companyId, companyId)).orderBy(desc(s.signals.signalDate)),
    db.select({ a: s.activities, user: s.users.name, person: s.people.name }).from(s.activities)
      .leftJoin(s.users, eq(s.activities.userId, s.users.id)).leftJoin(s.people, eq(s.activities.personId, s.people.id))
      .where(eq(s.activities.companyId, companyId)).orderBy(desc(s.activities.occurredAt)).limit(25),
    db.select().from(s.callQueue).where(eq(s.callQueue.companyId, companyId)),
    db.select().from(s.deals).where(eq(s.deals.companyId, companyId)),
    db.select().from(s.searches).where(eq(s.searches.companyId, companyId)),
  ]);
  return { company, people, signals, activities, queue: queue[0] ?? null, deals, searches };
}

// ---------- Signals ----------

export async function listSignals(opts: { status?: s.SignalStatus; sinceDays?: number; limit?: number } = {}) {
  const db = await getDb();
  const where = [];
  if (opts.status) where.push(eq(s.signals.status, opts.status));
  if (opts.sinceDays) where.push(gte(s.signals.signalDate, new Date(Date.now() - opts.sinceDays * DAY)));
  const rows = await db.select({ signal: s.signals, company: s.companies, person: s.people }).from(s.signals)
    .leftJoin(s.companies, eq(s.signals.companyId, s.companies.id)).leftJoin(s.people, eq(s.signals.personId, s.people.id))
    .where(and(...where));
  // Rank by ICP fit and freshness: a point of score is worth about a third of a day.
  const rank = (r: (typeof rows)[number]) => (r.company?.icpScore ?? 40) - ((Date.now() - r.signal.signalDate.getTime()) / DAY) * 3;
  return rows.sort((a, b) => rank(b) - rank(a)).slice(0, opts.limit ?? 200);
}

/** Add a signal. Duplicates (same external id, e.g. a LinkedIn Post ID) are skipped, never overwritten. */
export async function addSignal(input: { type: s.SignalType; title: string; summary?: string; roles?: string; category?: string; companyDomain?: string; companyName?: string; source: string; sourceUrl?: string; externalId?: string; signalDate?: string }) {
  const db = await getDb();
  if (input.externalId) {
    const [dupe] = await db.select().from(s.signals).where(eq(s.signals.externalId, input.externalId));
    if (dupe) return { signal: dupe, created: false };
  }
  let companyId: number | undefined;
  if (input.companyDomain || input.companyName) companyId = (await upsertCompany({ name: input.companyName ?? input.companyDomain!, domain: input.companyDomain })).company.id;
  const [signal] = await db.insert(s.signals).values({
    type: input.type, title: input.title, summary: input.summary, roles: input.roles, category: input.category, companyId,
    source: input.source, sourceUrl: input.sourceUrl, externalId: input.externalId, signalDate: input.signalDate ? new Date(input.signalDate) : new Date(),
  }).returning();
  return { signal, created: true };
}

export async function setSignalStatus(signalId: number, status: s.SignalStatus) {
  const db = await getDb();
  const [signal] = await db.update(s.signals).set({ status }).where(eq(s.signals.id, signalId)).returning();
  if (signal && status === "promoted" && signal.companyId) await addToCallList(signal.companyId, { topSignal: signal.title, personId: signal.personId ?? undefined, addedBy: "Signals inbox" });
  return signal;
}

// ---------- Call list ----------

export async function addToCallList(companyId: number, opts: { topSignal?: string; personId?: number; ownerId?: number; addedBy?: string } = {}) {
  const db = await getDb();
  const [company] = await db.select().from(s.companies).where(eq(s.companies.id, companyId));
  if (!company) throw new Error(`No company with id ${companyId}`);
  if (company.status === "do_not_contact") throw new Error(`${company.name} is marked do-not-contact`);
  const [existing] = await db.select().from(s.callQueue).where(eq(s.callQueue.companyId, companyId)).limit(1);
  if (existing) return { entry: existing, created: false };
  const [vendor] = await db.select().from(s.users).where(eq(s.users.role, "vendor"));
  const [entry] = await db.insert(s.callQueue).values({
    companyId, personId: opts.personId, ownerId: opts.ownerId ?? vendor?.id, topSignal: opts.topSignal, nextStep: "First call", nextStepDate: new Date(), addedBy: opts.addedBy ?? "Manual",
  }).returning();
  return { entry, created: true };
}

export async function listCallList(opts: { ownerId?: number; status?: s.CallQueueStatus } = {}) {
  const db = await getDb();
  const rows = await db.select({ entry: s.callQueue, company: s.companies, person: s.people, owner: s.users }).from(s.callQueue)
    .innerJoin(s.companies, eq(s.callQueue.companyId, s.companies.id)).leftJoin(s.people, eq(s.callQueue.personId, s.people.id)).leftJoin(s.users, eq(s.callQueue.ownerId, s.users.id))
    .where(and(opts.ownerId ? eq(s.callQueue.ownerId, opts.ownerId) : undefined, opts.status ? eq(s.callQueue.status, opts.status) : undefined))
    .orderBy(sql`${s.callQueue.nextStepDate} asc nulls last`);
  // Gatekeeper and dead-number rates per company show which HQ lines to swap for a local office number.
  const stats = await db.select({
    companyId: s.activities.companyId, dials: sql<number>`count(*)::int`,
    blocked: sql<number>`count(*) filter (where ${s.activities.outcome} in ('gatekeeper','dead_number'))::int`,
  }).from(s.activities).where(eq(s.activities.type, "call")).groupBy(s.activities.companyId);
  const byCompany = new Map(stats.map((x) => [x.companyId, x]));
  return rows.map((r) => ({ ...r, dials: byCompany.get(r.company.id)?.dials ?? 0, blocked: byCompany.get(r.company.id)?.blocked ?? 0 }));
}

const OUTCOME_TO_STATUS: Record<s.CallOutcome, s.CallQueueStatus> = {
  connected: "connected", meeting_booked: "meeting_booked", voicemail: "attempting", gatekeeper: "attempting", no_answer: "attempting", dead_number: "dead", do_not_contact: "do_not_contact",
};

/** Log a call outcome. Appends an activity and moves the call-list row; past activity is never edited. */
export async function logCall(input: { queueId: number; outcome: s.CallOutcome; notes?: string; nextStep?: string; nextStepDate?: string; userId?: number }) {
  const db = await getDb();
  const [entry] = await db.select().from(s.callQueue).where(eq(s.callQueue.id, input.queueId));
  if (!entry) throw new Error(`No call-list row with id ${input.queueId}`);
  await db.insert(s.activities).values({ type: "call", outcome: input.outcome, companyId: entry.companyId, personId: entry.personId, userId: input.userId ?? entry.ownerId, notes: input.notes });
  const retry = input.outcome === "voicemail" || input.outcome === "gatekeeper" || input.outcome === "no_answer";
  const [updated] = await db.update(s.callQueue).set({
    status: OUTCOME_TO_STATUS[input.outcome], lastContactAt: new Date(),
    nextStep: input.nextStep ?? (retry ? "Call back" : input.outcome === "connected" ? "Send follow-up email" : input.outcome === "meeting_booked" ? "Prep for meeting" : null),
    nextStepDate: input.nextStepDate ? new Date(input.nextStepDate) : retry ? new Date(Date.now() + 2 * DAY) : input.outcome === "connected" ? new Date(Date.now() + DAY) : null,
    notes: input.notes ?? entry.notes,
  }).where(eq(s.callQueue.id, input.queueId)).returning();
  if (input.outcome === "do_not_contact") await db.update(s.companies).set({ status: "do_not_contact" }).where(eq(s.companies.id, entry.companyId));
  return updated;
}

// ---------- LinkedIn connection queue (manual sends only) ----------

export async function listConnectionQueue() {
  const db = await getDb();
  return db.select({ person: s.people, company: s.companies }).from(s.people).leftJoin(s.companies, eq(s.people.companyId, s.companies.id))
    .where(and(eq(s.people.type, "decision_maker"), inArray(s.people.connectionStatus, ["queued", "note_ready", "sent"])))
    .orderBy(asc(s.people.connectionStatus), asc(s.people.name));
}

export async function listConnectCandidates() {
  const db = await getDb();
  return db.select({ person: s.people, company: s.companies }).from(s.people).innerJoin(s.companies, eq(s.people.companyId, s.companies.id))
    .where(and(eq(s.people.type, "decision_maker"), eq(s.people.connectionStatus, "none"))).orderBy(desc(s.companies.icpScore)).limit(12);
}

/** Tick "Connect?". Queues a job so the next Claude run writes the note. */
export async function queueConnection(personId: number) {
  const db = await getDb();
  const [person] = await db.update(s.people).set({ connectionStatus: "queued" }).where(eq(s.people.id, personId)).returning();
  if (!person) throw new Error(`No person with id ${personId}`);
  await queueJob({ kind: "draft_connection_notes", title: `Write a connection note for ${person.name}`, payload: { personIds: [personId] } });
  return person;
}

export async function saveConnectionNote(personId: number, note: string) {
  const db = await getDb();
  if (note.length > 300) throw new Error("LinkedIn connection notes are limited to 300 characters");
  const [person] = await db.update(s.people).set({ connectionNote: note, connectionStatus: "note_ready" }).where(eq(s.people.id, personId)).returning();
  if (!person) throw new Error(`No person with id ${personId}`);
  return person;
}

export async function setConnectionStatus(personId: number, status: s.ConnectionStatus, at: Date = new Date()) {
  const db = await getDb();
  const stamp = status === "sent" ? { connectionRequestedAt: at } : status === "connected" ? { connectedAt: at } : status === "none" ? { connectionRequestedAt: null, connectedAt: null } : {};
  const [person] = await db.update(s.people).set({ connectionStatus: status, ...stamp }).where(eq(s.people.id, personId)).returning();
  if (person && (status === "sent" || status === "connected")) {
    await db.insert(s.activities).values({ type: "linkedin", outcome: status === "sent" ? "request_sent" : "connected", personId, companyId: person.companyId, occurredAt: at });
  }
  return person;
}

/** Ask Claude for a first LinkedIn message to someone you are connected with. The draft lands in Outreach drafts for review. */
export async function queueMessageDraft(personId: number) {
  const db = await getDb();
  const [person] = await db.select().from(s.people).where(eq(s.people.id, personId));
  if (!person) throw new Error(`No person with id ${personId}`);
  return queueJob({ kind: "draft_linkedin_message", title: `Draft a LinkedIn message to ${person.name}`, payload: { personId } });
}

export async function listPeople(opts: { search?: string; connection?: s.ConnectionStatus; limit?: number } = {}) {
  const db = await getDb();
  const q = opts.search?.trim().toLowerCase();
  const like = q ? `%${q}%` : null;
  return db.select({ person: s.people, company: s.companies }).from(s.people).leftJoin(s.companies, eq(s.people.companyId, s.companies.id))
    .where(and(
      eq(s.people.type, "decision_maker"), opts.connection ? eq(s.people.connectionStatus, opts.connection) : undefined,
      like ? sql`(lower(${s.people.name}) like ${like} or lower(coalesce(${s.people.title}, '')) like ${like} or lower(coalesce(${s.companies.name}, '')) like ${like})` : undefined,
    ))
    .orderBy(asc(s.people.name)).limit(opts.limit ?? 100);
}

// ---------- Claude job queue ----------

export async function queueJob(input: { kind: string; title: string; payload?: Record<string, unknown> }) {
  const db = await getDb();
  const [job] = await db.insert(s.jobs).values({ kind: input.kind, title: input.title, payload: input.payload ?? {} }).returning();
  return job;
}

export async function listJobs(opts: { status?: s.JobStatus } = {}) {
  const db = await getDb();
  return db.select().from(s.jobs).where(opts.status ? eq(s.jobs.status, opts.status) : undefined).orderBy(desc(s.jobs.createdAt), desc(s.jobs.id));
}

export async function completeJob(jobId: number, result: string, failed = false) {
  const db = await getDb();
  const [job] = await db.update(s.jobs).set({ status: failed ? "failed" : "done", result, completedAt: new Date() }).where(eq(s.jobs.id, jobId)).returning();
  if (!job) throw new Error(`No job with id ${jobId}`);
  return job;
}

// ---------- Drafts, pipeline, tasks ----------

export async function listDrafts() {
  const db = await getDb();
  return db.select({ draft: s.drafts, person: s.people, company: s.companies }).from(s.drafts)
    .leftJoin(s.people, eq(s.drafts.personId, s.people.id)).leftJoin(s.companies, eq(s.drafts.companyId, s.companies.id)).orderBy(desc(s.drafts.createdAt), desc(s.drafts.id));
}

export async function saveDraft(input: { kind: s.DraftKind; personId?: number; companyId?: number; subject?: string; body: string }) {
  const db = await getDb();
  const [draft] = await db.insert(s.drafts).values(input).returning();
  return draft;
}

export async function setDraftStatus(draftId: number, status: "draft" | "approved" | "sent") {
  const db = await getDb();
  const [draft] = await db.update(s.drafts).set({ status }).where(eq(s.drafts.id, draftId)).returning();
  return draft;
}

export const fee = (salary: number, feePct: number) => Math.round((salary * feePct) / 100);

export async function listDeals() {
  const db = await getDb();
  return db.select({ deal: s.deals, company: s.companies, owner: s.users }).from(s.deals)
    .innerJoin(s.companies, eq(s.deals.companyId, s.companies.id)).leftJoin(s.users, eq(s.deals.ownerId, s.users.id));
}

export async function listTasks(opts: { openOnly?: boolean } = {}) {
  const db = await getDb();
  return db.select({ task: s.tasks, owner: s.users, company: s.companies }).from(s.tasks)
    .leftJoin(s.users, eq(s.tasks.ownerId, s.users.id)).leftJoin(s.companies, eq(s.tasks.companyId, s.companies.id))
    .where(opts.openOnly ? eq(s.tasks.done, false) : undefined).orderBy(asc(s.tasks.done), sql`${s.tasks.dueDate} asc nulls last`);
}

export async function addTask(input: { title: string; ownerId?: number; companyId?: number; dueDate?: string }) {
  const db = await getDb();
  const [task] = await db.insert(s.tasks).values({ title: input.title, ownerId: input.ownerId, companyId: input.companyId, dueDate: input.dueDate ? new Date(input.dueDate) : null }).returning();
  return task;
}

export async function setTaskDone(taskId: number, done: boolean) {
  const db = await getDb();
  await db.update(s.tasks).set({ done }).where(eq(s.tasks.id, taskId));
}

export async function listUsers() {
  return (await getDb()).select().from(s.users).orderBy(asc(s.users.id));
}

// ---------- Candidate sourcing ----------

export async function listSearches() {
  const db = await getDb();
  const rows = await db.select({ search: s.searches, company: s.companies }).from(s.searches).innerJoin(s.companies, eq(s.searches.companyId, s.companies.id)).orderBy(asc(s.searches.status), desc(s.searches.openedAt));
  const counts = await db.select({ searchId: s.searchCandidates.searchId, stage: s.searchCandidates.stage, n: sql<number>`count(*)::int` }).from(s.searchCandidates).groupBy(s.searchCandidates.searchId, s.searchCandidates.stage);
  return rows.map((r) => ({ ...r, stages: Object.fromEntries(counts.filter((c) => c.searchId === r.search.id).map((c) => [c.stage, c.n])) as Partial<Record<s.CandidateStage, number>> }));
}

export async function getSearch(searchId: number) {
  const db = await getDb();
  const [row] = await db.select({ search: s.searches, company: s.companies }).from(s.searches).innerJoin(s.companies, eq(s.searches.companyId, s.companies.id)).where(eq(s.searches.id, searchId));
  if (!row) return null;
  const candidates = await db.select({ link: s.searchCandidates, person: s.people }).from(s.searchCandidates).innerJoin(s.people, eq(s.searchCandidates.personId, s.people.id))
    .where(eq(s.searchCandidates.searchId, searchId)).orderBy(desc(s.searchCandidates.fitScore));
  return { ...row, candidates };
}

export async function setCandidateStage(linkId: number, stage: s.CandidateStage) {
  const db = await getDb();
  await db.update(s.searchCandidates).set({ stage }).where(eq(s.searchCandidates.id, linkId));
}

export async function listTalentPool(opts: { skill?: string } = {}) {
  const db = await getDb();
  const rows = await db.select().from(s.people).where(eq(s.people.type, "candidate")).orderBy(asc(s.people.name));
  const q = opts.skill?.toLowerCase().trim();
  return q ? rows.filter((p) => `${p.skills} ${p.title} ${p.location}`.toLowerCase().includes(q)) : rows;
}

// ---------- Business management ----------

export async function listAgreements() {
  const db = await getDb();
  return db.select({ agreement: s.agreements, company: s.companies }).from(s.agreements).innerJoin(s.companies, eq(s.agreements.companyId, s.companies.id)).orderBy(asc(s.agreements.status));
}

export async function listPlacements() {
  const db = await getDb();
  return db.select({ placement: s.placements, company: s.companies, person: s.people }).from(s.placements)
    .innerJoin(s.companies, eq(s.placements.companyId, s.companies.id)).leftJoin(s.people, eq(s.placements.personId, s.people.id)).orderBy(desc(s.placements.startDate));
}

export type KpiTargets = { dials: number; connects: number; meetings: number; agreements: number; placements: number; costPerMeeting: number; vendorWeeklyCost: number };

export async function getSetting<T>(key: string): Promise<T | null> {
  const [row] = await (await getDb()).select().from(s.settings).where(eq(s.settings.key, key));
  return (row?.value as T) ?? null;
}

/** Weekly funnel for the last `weeks` weeks (most recent first), optionally for one caller. */
export async function getKpis(opts: { weeks?: number; userId?: number } = {}) {
  const db = await getDb();
  const weeks = opts.weeks ?? 3;
  const since = new Date(Date.now() - weeks * 7 * DAY);
  const acts = await db.select().from(s.activities).where(and(gte(s.activities.occurredAt, since), opts.userId ? eq(s.activities.userId, opts.userId) : undefined));
  const agreements = await db.select().from(s.agreements);
  const placements = await db.select().from(s.placements);
  return Array.from({ length: weeks }, (_, w) => {
    const from = Date.now() - (w + 1) * 7 * DAY, to = Date.now() - w * 7 * DAY;
    const inWeek = (d: Date | null) => !!d && d.getTime() > from && d.getTime() <= to;
    const calls = acts.filter((a) => a.type === "call" && inWeek(a.occurredAt));
    const has = (...o: string[]) => calls.filter((a) => o.includes(a.outcome ?? "")).length;
    return {
      label: w === 0 ? "Last 7 days" : `${w * 7 + 1} to ${(w + 1) * 7} days ago`,
      dials: calls.length, connects: has("connected", "meeting_booked"), gatekeeper: has("gatekeeper"), deadNumbers: has("dead_number"),
      meetingsBooked: has("meeting_booked"), meetingsHeld: acts.filter((a) => a.type === "meeting" && inWeek(a.occurredAt)).length,
      agreements: agreements.filter((a) => inWeek(a.signedAt)).length, placements: placements.filter((p) => inWeek(p.startDate)).length,
    };
  });
}

export async function getCredits() {
  const db = await getDb();
  const ledger = await db.select().from(s.creditLedger).orderBy(desc(s.creditLedger.createdAt), desc(s.creditLedger.id));
  const budget = (await getSetting<{ cycleCredits: number; reservePct: number; cycleResets: string }>("apollo_budget")) ?? { cycleCredits: 0, reservePct: 20, cycleResets: "" };
  const balance = ledger[0]?.balanceAfter ?? budget.cycleCredits;
  const reserve = Math.round((budget.cycleCredits * budget.reservePct) / 100);
  return { ledger, budget, balance, reserve, spendable: Math.max(0, balance - reserve), spent: budget.cycleCredits - balance };
}

/** Record the real Apollo balance (from a Claude run or the API) so the budget screen stays honest. Appends; never edits history. */
export async function recordCredits(input: { balance: number; reason: string }) {
  const db = await getDb();
  const [last] = await db.select().from(s.creditLedger).orderBy(desc(s.creditLedger.createdAt), desc(s.creditLedger.id)).limit(1);
  const [row] = await db.insert(s.creditLedger).values({ delta: input.balance - (last?.balanceAfter ?? input.balance), reason: input.reason, balanceAfter: input.balance }).returning();
  return row;
}

/** Bring companies in from an outside source. Appends new ones; anything already known (by domain) is left untouched. */
export async function importCompanies(rows: { name: string; domain: string | null; industry?: string | null; location?: string | null; employees?: number | null; phone?: string | null; apolloId?: string | null }[]) {
  let added = 0, skipped = 0, noDomain = 0;
  for (const r of rows) {
    if (!r.domain) { noDomain++; continue; }
    const { created } = await upsertCompany({ name: r.name, domain: r.domain, industry: r.industry ?? undefined, location: r.location ?? undefined, employees: r.employees ?? undefined, hqPhone: r.phone ?? undefined, apolloId: r.apolloId ?? undefined });
    if (created) added++; else skipped++;
  }
  return { added, skipped, noDomain };
}

/** The numbers on the Today screen, and what Claude sees first when it asks "what's going on?". */
export async function getOverview() {
  const db = await getDb();
  const n = async (q: Promise<{ n: number }[]>) => (await q)[0].n;
  const c = sql<number>`count(*)::int`;
  const endOfToday = new Date(new Date().setHours(23, 59, 59, 999));
  const [newSignals, callsDue, notesWaiting, readyToSend, jobsQueued, draftsToReview, openTasks] = await Promise.all([
    n(db.select({ n: c }).from(s.signals).where(eq(s.signals.status, "new"))),
    n(db.select({ n: c }).from(s.callQueue).where(and(sql`${s.callQueue.nextStepDate} <= ${endOfToday.toISOString()}`, inArray(s.callQueue.status, ["new", "attempting", "connected"])))),
    n(db.select({ n: c }).from(s.people).where(eq(s.people.connectionStatus, "queued"))),
    n(db.select({ n: c }).from(s.people).where(eq(s.people.connectionStatus, "note_ready"))),
    n(db.select({ n: c }).from(s.jobs).where(eq(s.jobs.status, "queued"))),
    n(db.select({ n: c }).from(s.drafts).where(eq(s.drafts.status, "draft"))),
    n(db.select({ n: c }).from(s.tasks).where(eq(s.tasks.done, false))),
  ]);
  const credits = await getCredits();
  return { newSignals, callsDue, notesWaiting, readyToSend, jobsQueued, draftsToReview, openTasks, apolloCreditsSpendable: credits.spendable, apolloCreditsBalance: credits.balance };
}
