/**
 * The logic layer. Screens (server actions) and Claude (MCP tools) both call these
 * functions, so a rule such as "dedupe companies on domain" lives in exactly one place.
 */
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { addPhone, phoneStatusAfter, phonesForCompanies, type PhoneWithStats } from "./phones";
import { checkStaffing } from "./staffing";

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
  if (input.hqPhone) await addPhone({ companyId: company.id, number: input.hqPhone, kind: "company_main", label: "Company phone", source: input.apolloId ? "apollo" : "manual" });
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
  const [people, signals, activities, calls, queue, deals, searches, phones] = await Promise.all([
    db.select().from(s.people).where(and(eq(s.people.companyId, companyId), eq(s.people.type, "decision_maker"))),
    db.select().from(s.signals).where(eq(s.signals.companyId, companyId)).orderBy(desc(s.signals.signalDate)),
    db.select({ a: s.activities, user: s.users.name, person: s.people.name }).from(s.activities)
      .leftJoin(s.users, eq(s.activities.userId, s.users.id)).leftJoin(s.people, eq(s.activities.personId, s.people.id))
      .where(eq(s.activities.companyId, companyId)).orderBy(desc(s.activities.occurredAt)).limit(25),
    db.select({ c: s.callLog, user: s.users.name, person: s.people.name, number: s.phoneNumbers.number }).from(s.callLog)
      .leftJoin(s.users, eq(s.callLog.userId, s.users.id)).leftJoin(s.people, eq(s.callLog.personId, s.people.id)).leftJoin(s.phoneNumbers, eq(s.callLog.phoneNumberId, s.phoneNumbers.id))
      .where(eq(s.callLog.companyId, companyId)).orderBy(desc(s.callLog.calledAt)).limit(50),
    db.select().from(s.callQueue).where(eq(s.callQueue.companyId, companyId)),
    db.select().from(s.deals).where(eq(s.deals.companyId, companyId)),
    db.select().from(s.searches).where(eq(s.searches.companyId, companyId)),
    phonesForCompanies([companyId]),
  ]);
  // One timeline: calls from the call log plus every other touch.
  const timeline = [
    ...calls.map(({ c, user, person, number }) => ({ key: `c${c.id}`, at: c.calledAt, type: "call", outcome: c.outcome as string, notes: c.notes, user, person, number })),
    ...activities.map(({ a, user, person }) => ({ key: `a${a.id}`, at: a.occurredAt, type: a.type as string, outcome: a.outcome ?? "", notes: a.notes, user, person, number: null as string | null })),
  ].sort((x, y) => y.at.getTime() - x.at.getTime());
  return { company, people, signals, timeline, queue: queue[0] ?? null, deals, searches, phones: phones.get(companyId) ?? [] };
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
  const phones = await phonesForCompanies(rows.map((r) => r.company.id));
  // Each row gets the numbers a caller could dial: the contact's own lines first, then company lines.
  return rows.map((r) => ({ ...r, phones: rowPhones(phones.get(r.company.id) ?? [], r.person?.id) }));
}

const rowPhones = (all: PhoneWithStats[], personId?: number | null) =>
  [...all.filter((p) => p.personId && p.personId === personId), ...all.filter((p) => !p.personId)];
export const usable = (p: { status: s.PhoneStatus }) => p.status !== "bad" && p.status !== "do_not_call";

/** The outcome of a call decides where the row stands. Callers pick the outcome; the status follows. */
export const OUTCOME_TO_STATUS: Record<s.CallOutcome, s.CallQueueStatus> = {
  connected: "connected", meeting_booked: "meeting_booked", email_requested: "connected",
  voicemail: "attempting", no_answer: "attempting", gatekeeper: "attempting",
  bad_number: "needs_info", wrong_person: "needs_info", not_interested: "closed", do_not_contact: "do_not_contact",
};
const NEXT_STEP: Record<s.CallOutcome, [string | null, number | null]> = {
  connected: ["Send follow-up email", 1], meeting_booked: ["Prep for meeting", null], email_requested: ["Send the email they asked for", 0],
  voicemail: ["Call back", 2], no_answer: ["Call back", 2], gatekeeper: ["Call back, ask for them by name", 2],
  bad_number: ["Find a working number", 0], wrong_person: ["Find the right contact", 0], not_interested: [null, null], do_not_contact: [null, null],
};

/**
 * Log one dial. Adds a call-log row against the number dialed, updates what we know about
 * that number, and moves the call-list row. Past calls are never edited.
 */
export async function logCall(input: { queueId: number; outcome: s.CallOutcome; phoneNumberId?: number; notes?: string; nextStep?: string; nextStepDate?: string; userId?: number }) {
  const db = await getDb();
  const [entry] = await db.select().from(s.callQueue).where(eq(s.callQueue.id, input.queueId));
  if (!entry) throw new Error(`No call-list row with id ${input.queueId}`);
  const phones = rowPhones((await phonesForCompanies([entry.companyId])).get(entry.companyId) ?? [], entry.personId);
  const dialed = phones.find((p) => p.id === input.phoneNumberId) ?? phones.find(usable) ?? phones[0];
  await db.insert(s.callLog).values({ callQueueId: entry.id, companyId: entry.companyId, personId: entry.personId, phoneNumberId: dialed?.id, userId: input.userId ?? entry.ownerId, outcome: input.outcome, notes: input.notes });
  const learned = phoneStatusAfter(input.outcome);
  if (dialed && learned) await db.update(s.phoneNumbers).set({ status: learned }).where(eq(s.phoneNumbers.id, dialed.id));

  // A bad number only stalls the row when there is no other number left to try.
  const another = input.outcome === "bad_number" && phones.some((p) => p.id !== dialed?.id && usable(p));
  const status = another ? "attempting" : OUTCOME_TO_STATUS[input.outcome];
  const [step, days] = another ? ["Try the next number", 0] : NEXT_STEP[input.outcome];
  const [updated] = await db.update(s.callQueue).set({
    status, lastContactAt: new Date(), nextStep: input.nextStep ?? step,
    nextStepDate: input.nextStepDate ? new Date(input.nextStepDate) : days == null ? null : new Date(Date.now() + days * DAY),
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

/** The same request for the same thing, as one string. Used to stop a job being queued twice. */
export const jobKey = (kind: string, payload: Record<string, unknown> = {}) => `${kind}|${Object.keys(payload).sort().map((k) => `${k}=${JSON.stringify(payload[k])}`).join("&")}`;

/** Queue work for Claude. Asking twice for the same thing returns the job already waiting. */
export async function queueJob(input: { kind: string; title: string; payload?: Record<string, unknown> }) {
  const db = await getDb();
  const key = jobKey(input.kind, input.payload);
  const waiting = (await db.select().from(s.jobs).where(eq(s.jobs.status, "queued"))).find((j) => jobKey(j.kind, j.payload) === key);
  if (waiting) return waiting;
  const [job] = await db.insert(s.jobs).values({ kind: input.kind, title: input.title, payload: input.payload ?? {} }).returning();
  return job;
}

/** Take a job off the queue before Claude gets to it. */
export async function cancelJob(jobId: number) {
  await (await getDb()).delete(s.jobs).where(and(eq(s.jobs.id, jobId), eq(s.jobs.status, "queued")));
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
  const rows = await db.select({ search: s.searches, company: s.companies }).from(s.searches).leftJoin(s.companies, eq(s.searches.companyId, s.companies.id)).orderBy(asc(s.searches.status), desc(s.searches.openedAt), asc(s.searches.id));
  const counts = await db.select({ searchId: s.searchCandidates.searchId, stage: s.searchCandidates.stage, n: sql<number>`count(*)::int` }).from(s.searchCandidates).groupBy(s.searchCandidates.searchId, s.searchCandidates.stage);
  return rows.map((r) => ({ ...r, client: r.company?.name ?? r.search.clientName ?? "Client not set", stages: Object.fromEntries(counts.filter((c) => c.searchId === r.search.id).map((c) => [c.stage, c.n])) as Partial<Record<s.CandidateStage, number>> }));
}

export async function getSearch(searchId: number) {
  const db = await getDb();
  const [row] = await db.select({ search: s.searches, company: s.companies }).from(s.searches).leftJoin(s.companies, eq(s.searches.companyId, s.companies.id)).where(eq(s.searches.id, searchId));
  if (!row) return null;
  const candidates = await db.select({ link: s.searchCandidates, person: s.people }).from(s.searchCandidates).innerJoin(s.people, eq(s.searchCandidates.personId, s.people.id))
    .where(eq(s.searchCandidates.searchId, searchId)).orderBy(desc(s.searchCandidates.fitScore));
  return { ...row, client: row.company?.name ?? row.search.clientName ?? "Client not set", candidates };
}

export async function setCandidateStage(linkId: number, stage: s.CandidateStage) {
  const db = await getDb();
  await db.update(s.searchCandidates).set({ stage }).where(eq(s.searchCandidates.id, linkId));
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

/** Weekly funnel for the last `weeks` weeks (most recent first), optionally for one caller. Dials come from the call log. */
export async function getKpis(opts: { weeks?: number; userId?: number } = {}) {
  const db = await getDb();
  const weeks = opts.weeks ?? 3;
  const since = new Date(Date.now() - weeks * 7 * DAY);
  const calls = await db.select().from(s.callLog).where(and(gte(s.callLog.calledAt, since), opts.userId ? eq(s.callLog.userId, opts.userId) : undefined));
  const acts = await db.select().from(s.activities).where(and(gte(s.activities.occurredAt, since), opts.userId ? eq(s.activities.userId, opts.userId) : undefined));
  const agreements = await db.select().from(s.agreements);
  const placements = await db.select().from(s.placements);
  return Array.from({ length: weeks }, (_, w) => {
    const from = Date.now() - (w + 1) * 7 * DAY, to = Date.now() - w * 7 * DAY;
    const inWeek = (d: Date | null) => !!d && d.getTime() > from && d.getTime() <= to;
    const wk = calls.filter((c) => inWeek(c.calledAt));
    const has = (...o: string[]) => wk.filter((c) => o.includes(c.outcome)).length;
    return {
      label: w === 0 ? "Last 7 days" : `${w * 7 + 1} to ${(w + 1) * 7} days ago`,
      dials: wk.length, connects: has("connected", "meeting_booked", "email_requested"), gatekeeper: has("gatekeeper"), badNumbers: has("bad_number"),
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
  let added = 0, skipped = 0, noDomain = 0, staffingDropped = 0;
  for (const r of rows) {
    if (!r.domain) { noDomain++; continue; }
    if (await checkStaffing(r.name, "Company import")) { staffingDropped++; continue; }
    const { created } = await upsertCompany({ name: r.name, domain: r.domain, industry: r.industry ?? undefined, location: r.location ?? undefined, employees: r.employees ?? undefined, hqPhone: r.phone ?? undefined, apolloId: r.apolloId ?? undefined });
    if (created) added++; else skipped++;
  }
  return { added, skipped, noDomain, staffingDropped };
}

/** The numbers on the Today screen, and what Claude sees first when it asks "what's going on?". */
export async function getOverview() {
  const db = await getDb();
  const n = async (q: Promise<{ n: number }[]>) => (await q)[0].n;
  const c = sql<number>`count(*)::int`;
  const endOfToday = new Date(new Date().setHours(23, 59, 59, 999));
  const [newSignals, callsDue, notesWaiting, readyToSend, jobsQueued, draftsToReview, openTasks] = await Promise.all([
    n(db.select({ n: c }).from(s.signals).where(eq(s.signals.status, "new"))),
    n(db.select({ n: c }).from(s.callQueue).where(and(sql`${s.callQueue.nextStepDate} <= ${endOfToday.toISOString()}`, inArray(s.callQueue.status, ["new", "attempting", "connected", "needs_info"])))),
    n(db.select({ n: c }).from(s.people).where(eq(s.people.connectionStatus, "queued"))),
    n(db.select({ n: c }).from(s.people).where(eq(s.people.connectionStatus, "note_ready"))),
    n(db.select({ n: c }).from(s.jobs).where(eq(s.jobs.status, "queued"))),
    n(db.select({ n: c }).from(s.drafts).where(eq(s.drafts.status, "draft"))),
    n(db.select({ n: c }).from(s.tasks).where(eq(s.tasks.done, false))),
  ]);
  const credits = await getCredits();
  return { newSignals, callsDue, notesWaiting, readyToSend, jobsQueued, draftsToReview, openTasks, apolloCreditsSpendable: credits.spendable, apolloCreditsBalance: credits.balance };
}

// ---------- Adding to the business side by hand ----------

/** Find a company by name, or add it. Used by the add forms, where only a name is typed. */
async function companyByName(name: string) {
  if (!name.trim()) throw new Error("Type the company name");
  return (await upsertCompany({ name })).company;
}

export async function addDeal(input: { companyName: string; roleTitle: string; estSalary: number; feePct: number; stage?: s.DealStage }) {
  const db = await getDb();
  if (!input.roleTitle.trim() || !(input.estSalary > 0) || !(input.feePct > 0)) throw new Error("A deal needs a role, a salary and a fee percentage");
  const company = await companyByName(input.companyName);
  const [owner] = await db.select().from(s.users).where(eq(s.users.role, "owner"));
  return (await db.insert(s.deals).values({ companyId: company.id, roleTitle: input.roleTitle.trim(), estSalary: Math.round(input.estSalary), feePct: Math.round(input.feePct), stage: input.stage ?? "first_meeting", ownerId: owner?.id }).returning())[0];
}
export async function setDealStage(id: number, stage: s.DealStage) { await (await getDb()).update(s.deals).set({ stage }).where(eq(s.deals.id, id)); }

export async function addAgreement(input: { companyName: string; feePct: number; guaranteeDays: number; status: "draft" | "sent" | "signed" }) {
  const db = await getDb();
  const company = await companyByName(input.companyName);
  if (input.status === "signed") await db.update(s.companies).set({ status: "client" }).where(eq(s.companies.id, company.id));
  return (await db.insert(s.agreements).values({ companyId: company.id, kind: "Direct-hire (contingency)", feePct: Math.round(input.feePct) || 20, guaranteeDays: Math.round(input.guaranteeDays) || 90, status: input.status, provider: "PandaDoc", signedAt: input.status === "signed" ? new Date() : null }).returning())[0];
}
export async function setAgreementStatus(id: number, status: "draft" | "sent" | "signed") {
  const db = await getDb();
  const [a] = await db.update(s.agreements).set({ status, signedAt: status === "signed" ? new Date() : null }).where(eq(s.agreements.id, id)).returning();
  if (a && status === "signed") await db.update(s.companies).set({ status: "client" }).where(eq(s.companies.id, a.companyId));
}

export async function addPlacement(input: { companyName: string; roleTitle: string; salary: number; feePct: number; startDate?: string }) {
  const db = await getDb();
  if (!input.roleTitle.trim() || !(input.salary > 0)) throw new Error("A placement needs a role and a salary");
  const company = await companyByName(input.companyName);
  return (await db.insert(s.placements).values({ companyId: company.id, roleTitle: input.roleTitle.trim(), salary: Math.round(input.salary), feePct: Math.round(input.feePct) || 20, startDate: input.startDate ? new Date(`${input.startDate}T12:00:00`) : null }).returning())[0];
}
export async function setInvoiceStatus(id: number, status: s.InvoiceStatus) {
  await (await getDb()).update(s.placements).set({ invoiceStatus: status, dueDate: status === "invoiced" ? new Date(Date.now() + 30 * DAY) : undefined }).where(eq(s.placements.id, id));
}

// ---------- Things a Claude run reports back ----------

/** Keep the latest weekly review so it shows on the Numbers screen. */
export async function saveWeeklyReview(text: string) {
  const db = await getDb();
  const value = { text: text.trim(), savedAt: new Date().toISOString() };
  await db.insert(s.settings).values({ key: "weekly_review", value }).onConflictDoUpdate({ target: s.settings.key, set: { value } });
  return value;
}

/**
 * Record that someone replied (found in Gmail by a Claude run, or noticed by hand). This is what
 * stops the app from suggesting a follow-up to a person who has already answered.
 */
export async function logReply(input: { personId: number; channel: "email" | "linkedin" | "text"; summary: string; searchId?: number; interested?: boolean }) {
  const db = await getDb();
  const [person] = await db.select().from(s.people).where(eq(s.people.id, input.personId));
  if (!person) throw new Error(`No person with id ${input.personId}`);
  await db.insert(s.activities).values({ type: input.channel, outcome: "replied", personId: person.id, companyId: person.companyId, searchId: input.searchId, notes: input.summary });
  if (input.searchId) {
    const [link] = await db.select().from(s.searchCandidates).where(and(eq(s.searchCandidates.searchId, input.searchId), eq(s.searchCandidates.personId, person.id)));
    if (link && input.interested === false) await db.update(s.searchCandidates).set({ stage: "rejected", fitNotes: `Not interested: ${input.summary}`.slice(0, 300) }).where(eq(s.searchCandidates.id, link.id));
  }
  return { person: person.name, logged: true };
}

/** Save the one-page brief for a company, shown at the top of its page. */
export async function saveCompanyBrief(companyId: number, brief: string) {
  const [c] = await (await getDb()).update(s.companies).set({ brief: brief.trim() }).where(eq(s.companies.id, companyId)).returning();
  if (!c) throw new Error(`No company with id ${companyId}`);
  return { company: c.name, saved: true };
}

export async function saveSetting(key: string, value: unknown) {
  await (await getDb()).insert(s.settings).values({ key, value }).onConflictDoUpdate({ target: s.settings.key, set: { value } });
}
