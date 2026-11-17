/**
 * Importers for the data the routines produce today: the DFC call sheet, the LinkedIn
 * hiring posts sheet, LinkedIn job alert emails and LinkedIn's own Connections export.
 *
 * Rows arrive as objects keyed by the sheet's header text, so column order never matters.
 * Every importer can be run again safely: it adds what is new and skips what it has seen.
 * The original row is kept in `raw`, so no column is lost while the model is still settling.
 */
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { normalizeLinkedIn, upsertCompany, upsertPerson } from "./index";
import { addPhone, extractPhones, phoneDigits, phoneStatusAfter } from "./phones";
import { addStaffingFirm, checkStaffing } from "./staffing";

type Row = Record<string, string>;
const v = (r: Row, k: string) => (r[k] ?? "").toString().trim() || undefined;
const int = (r: Row, k: string) => { const n = parseInt((v(r, k) ?? "").replace(/[^0-9-]/g, ""), 10); return Number.isFinite(n) ? n : undefined; };
const truthy = (x: string | undefined) => /^(true|yes|y|x|1)$/i.test(x ?? "");
/** Accepts 11/10/2026, 2026-11-16 and "16 Nov 2026". Noon, so the day survives time zones. */
export function parseDate(x: string | undefined): Date | undefined {
  if (!x) return undefined;
  const us = x.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const d = us ? new Date(+us[3], +us[1] - 1, +us[2], 12) : new Date(/^\d{4}-\d{2}-\d{2}$/.test(x) ? `${x}T12:00:00` : x);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Compare two rows regardless of key order (the database stores them with keys sorted). */
const sameRow = (a: Row | null, b: Row) => !!a && Object.keys({ ...a, ...b }).every((k) => (a[k] ?? "") === (b[k] ?? ""));

// ---------- Call sheet ----------

/**
 * The sheet's Call Status wording, mapped to the app's statuses. The original wording is kept in
 * sourceStatus. "Error" in the sheet has meant a number that does not work, so it becomes
 * "needs info" (find a working number), not a dead lead.
 */
export const CALL_STATUS_MAP: Record<string, s.CallQueueStatus> = {
  "not started": "new", "left voicemail": "attempting", "called - no answer": "attempting", emailed: "attempting", "e-mail requested": "connected",
  connected: "connected", "meeting booked": "meeting_booked", error: "needs_info", "wrong contact": "needs_info", "new information needed": "needs_info", "do not contact": "do_not_contact",
};

/** Guess a call outcome from one line of DFC notes. Heuristic: good enough to spot bad numbers, not for exact counts. */
function outcomeFromNote(text: string, fallback: s.CallOutcome | "other"): s.CallOutcome | "other" {
  const t = text.toLowerCase();
  if (/not in service|disconnected|wrong number|invalid|not a working|no longer in|fax (line|number|machine)/.test(t)) return "bad_number";
  if (/do not (call|contact)|remove (me|us)|stop calling/.test(t)) return "do_not_contact";
  if (/no longer (with|works|at)|left the company|wrong (person|contact)|not the right/.test(t)) return "wrong_person";
  if (/send (an |me an? )?e-?mail|email (him|her|them|me)|requested (an )?e-?mail/.test(t)) return "email_requested";
  if (/voicemail|voice mail|\bvm\b|left (a )?(detailed )?message/.test(t)) return "voicemail";
  // A menu, a hold queue or a front desk is a gatekeeper even when a person answered.
  if (/front desk|receptionist|operator|gatekeeper|phone tree|company menu|main menu|directory|automated|auto.?attendant|placed on (a )?hold|would not transfer|not available|no one by that name/.test(t)) return "gatekeeper";
  if (/spoke (with|to)|talked (with|to)|conversation with/.test(t)) return "connected";
  if (/no answer|rang out|did not answer|didn't answer|rang until/.test(t)) return "no_answer";
  return fallback;
}

/** DFC Notes hold one entry per touch, each starting with a date like "11/10-". Split them so each becomes a logged call. */
export function splitDfcNotes(notes: string, year: number): { date: Date; text: string }[] {
  const out: { date: Date; text: string }[] = [];
  // Entries look like "11/10- +1 216... - DC" or "RR 11/10 Called ...": optional caller initials, then a date.
  for (const chunk of notes.split(/\n\s*\n|\n(?=(?:[A-Za-z]{2,3}\s+)?\d{1,2}\/\d{1,2}\b)/)) {
    const m = chunk.trim().match(/^(?:[A-Za-z]{2,3}\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*[-–:]?\s*([\s\S]+)$/);
    if (m) out.push({ date: new Date(m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : year, +m[1] - 1, +m[2], 12), text: m[4].trim() });
  }
  return out;
}

export async function importCallSheet(rows: Row[]) {
  const db = await getDb();
  const [vendor] = await db.select().from(s.users).where(eq(s.users.role, "vendor"));
  const res = { rows: rows.length, added: 0, updated: 0, unchanged: 0, skipped: 0, companiesAdded: 0, peopleAdded: 0, callsLogged: 0 };
  for (const r of rows) {
    const companyName = v(r, "Company"), personName = v(r, "Name");
    if (!companyName) { res.skipped++; continue; }
    const { company, created: companyCreated } = await upsertCompany({
      name: companyName, website: v(r, "company_website"), domain: v(r, "company_website"), employees: int(r, "Employees"), headcountGrowth: v(r, "Headcount Growth (6 mo)"),
      keywords: v(r, "Company Keywords"), recruitingTeamSize: int(r, "Recruiter Team Size"), technicalRecruiters: int(r, "Technical Recruiters"), dataTeamSize: int(r, "Analytics Team Size"),
      avgDataSalaryK: int(r, "Avg Data Salary ($K)"), openDataRoles: int(r, "Open Data Roles"), hqPhone: v(r, "Company Phone"), altPhones: v(r, "Alt Company Phones"),
      apolloId: v(r, "apollo_org_id"), apolloAccountId: v(r, "apollo_account_id"),
    });
    if (companyCreated) res.companiesAdded++;
    let personId: number | undefined;
    if (personName) {
      const { person, created } = await upsertPerson({
        name: personName, title: v(r, "Title"), timeInRole: v(r, "Time in Role"), email: v(r, "Email"), phone: v(r, "Phone"), phoneType: v(r, "Phone Type")?.toLowerCase(),
        location: v(r, "Location"), companyId: company.id, linkedinUrl: v(r, "person_linkedin"), apolloId: v(r, "apollo_person_id"), apolloContactId: v(r, "apollo_contact_id"),
        contactRevealed: !!(v(r, "Email") || v(r, "Phone")),
      });
      personId = person.id;
      if (created) res.peopleAdded++;
    }
    // Phone numbers, each with where it came from.
    if (v(r, "Phone")) await addPhone({ companyId: company.id, personId, number: v(r, "Phone")!, kind: /mobile/i.test(v(r, "Phone Type") ?? "") ? "mobile" : "direct", source: "apollo" });
    if (v(r, "Company Phone")) await addPhone({ companyId: company.id, number: v(r, "Company Phone")!, kind: "company_main", label: "Company phone", source: "apollo" });
    for (const line of (v(r, "Alt Company Phones") ?? "").split("\n")) {
      // Each line reads: number | what it is | where it was found
      const [num, what, where] = line.split("|").map((x) => x.trim());
      if (num) await addPhone({ companyId: company.id, number: num, kind: /office/i.test(what ?? "") ? "company_office" : "unknown", label: what, source: "claude_research", sourceDetail: where });
    }

    const sourceStatus = v(r, "Call Status") ?? "Not Started";
    const status = CALL_STATUS_MAP[sourceStatus.toLowerCase()] ?? "attempting";
    const lastContactAt = parseDate(v(r, "Last Contact Date"));
    const roles = int(r, "Open Data Roles"), tenure = v(r, "Time in Role");
    const topSignal = [roles ? `${roles} open data role${roles > 1 ? "s" : ""}` : null, tenure && /<\s*6/.test(tenure) ? "New leader (under 6 months in role)" : null,
      (int(r, "Recruiter Team Size") ?? 9) <= 2 && (int(r, "Technical Recruiters") ?? 9) === 0 ? "Thin recruiting team" : null].filter(Boolean).join(" · ") || null;
    const fields = {
      companyId: company.id, personId, status, sourceStatus, lastContactAt: lastContactAt ?? null, nextStep: v(r, "Next Step") ?? null, nextStepDate: parseDate(v(r, "Next Step Date")) ?? null,
      meetingBooked: v(r, "Meeting Booked") ?? null, notes: v(r, "DFC Notes") ?? null, alternateDms: v(r, "Alternate Decision Makers") ?? null, batch: v(r, "batch") ?? null, topSignal, raw: r,
    };
    const sourceKey = `call-sheet:${v(r, "apollo_contact_id") ?? normalizeLinkedIn(v(r, "person_linkedin")) ?? `${companyName}|${personName ?? ""}`.toLowerCase()}`;
    const [existing] = await db.select().from(s.callQueue).where(eq(s.callQueue.sourceKey, sourceKey));
    if (existing && sameRow(existing.raw, r)) { res.unchanged++; continue; }
    // A row that changed in the sheet refreshes the working columns. While the team still works in the sheet, the sheet wins.
    let queueId = existing?.id;
    if (existing) { await db.update(s.callQueue).set(fields).where(eq(s.callQueue.id, existing.id)); res.updated++; }
    else { queueId = (await db.insert(s.callQueue).values({ ...fields, sourceKey, ownerId: vendor?.id, addedBy: "Call sheet import" }).returning())[0].id; res.added++; }
    if (status === "do_not_contact") await db.update(s.companies).set({ status: "do_not_contact" }).where(eq(s.companies.id, company.id));

    // Turn the notes into call-log rows, each tied to the number that was dialed. Entries already logged are skipped.
    const entries = splitDfcNotes(v(r, "DFC Notes") ?? "", (lastContactAt ?? new Date()).getFullYear());
    // The row's status only tells us about a call when there is exactly one call. With several, an unreadable note stays "other".
    const fallback: s.CallOutcome | "other" = entries.length > 1 ? "other" : status === "connected" ? "connected" : status === "meeting_booked" ? "meeting_booked" : status === "do_not_contact" ? "do_not_contact" : status === "attempting" ? "no_answer" : "other";
    if (entries.length === 0 && lastContactAt) entries.push({ date: lastContactAt, text: `${sourceStatus} (from call sheet, no note)` });
    for (const e of entries) {
      if (/^(emailed|e-?mail sent|sent (an )?e-?mail)/i.test(e.text)) {
        const [seen] = await db.select({ id: s.activities.id }).from(s.activities).where(and(eq(s.activities.companyId, company.id), eq(s.activities.notes, e.text))).limit(1);
        if (!seen) await db.insert(s.activities).values({ type: "email", outcome: "sent", companyId: company.id, personId, userId: vendor?.id, notes: e.text, occurredAt: e.date });
        continue;
      }
      const [seen] = await db.select({ id: s.callLog.id }).from(s.callLog).where(and(eq(s.callLog.companyId, company.id), eq(s.callLog.notes, e.text))).limit(1);
      if (seen) continue;
      // The note usually names the number dialed. Match it to a known number, or record it as a new one from the sheet.
      const said = extractPhones(e.text)[0];
      let phoneId: number | undefined;
      if (said) {
        const [known] = await db.select().from(s.phoneNumbers).where(and(eq(s.phoneNumbers.companyId, company.id), eq(s.phoneNumbers.digits, phoneDigits(said)))).limit(1);
        phoneId = known?.id ?? (await addPhone({ companyId: company.id, number: said, source: "call_sheet", label: "Dialed by the caller" }))?.phone.id;
      }
      const outcome = outcomeFromNote(e.text, fallback);
      await db.insert(s.callLog).values({ callQueueId: queueId, companyId: company.id, personId, phoneNumberId: phoneId, userId: vendor?.id, outcome, notes: e.text, source: "call_sheet", calledAt: e.date });
      const learned = phoneStatusAfter(outcome);
      if (phoneId && learned) await db.update(s.phoneNumbers).set({ status: learned }).where(eq(s.phoneNumbers.id, phoneId));
      res.callsLogged++;
    }
  }
  return res;
}

// ---------- LinkedIn hiring posts ----------

export async function importHiringPosts(rows: Row[]) {
  const db = await getDb();
  const res = { rows: rows.length, added: 0, alreadyThere: 0, skipped: 0, companiesAdded: 0, peopleAdded: 0, staffingDropped: 0, dismissedNonUs: 0 };
  for (const r of rows) {
    const postId = v(r, "Post ID") ?? v(r, "Post Link")?.match(/activity-(\d+)/)?.[1];
    if (!postId) { res.skipped++; continue; }
    const [dupe] = await db.select({ id: s.signals.id }).from(s.signals).where(eq(s.signals.externalId, postId));
    if (dupe) { res.alreadyThere++; continue; }
    const category = v(r, "Category"), notes = v(r, "Notes"), poster = v(r, "Poster Name"), companyName = v(r, "Company");
    // Staffing firms go to the archive, not the inbox.
    const markedStaffing = /staffing\s*-\s*exclude/i.test(`${category} ${notes}`);
    if (companyName && markedStaffing) await addStaffingFirm({ name: companyName, domain: v(r, "Company Website"), status: "confirmed", source: "LinkedIn hiring posts", note: "Marked Staffing - exclude in the posts sheet" });
    if (markedStaffing || (companyName && (await checkStaffing(companyName, "LinkedIn hiring posts")))) { res.staffingDropped++; continue; }
    let companyId: number | undefined, personId: number | undefined;
    if (companyName) {
      const { company, created } = await upsertCompany({ name: companyName, website: v(r, "Company Website"), domain: v(r, "Company Website"), apolloId: v(r, "Apollo Company ID") });
      companyId = company.id;
      if (created) res.companiesAdded++;
    }
    if (poster) {
      const note = v(r, "Connection Note");
      const { person, created } = await upsertPerson({
        name: poster, title: v(r, "Poster Title"), companyId, linkedinUrl: v(r, "Person LinkedIn"), apolloId: v(r, "Apollo Person ID"), connectionNote: note,
        connectionStatus: truthy(v(r, "Connected")) ? "connected" : note ? "note_ready" : truthy(v(r, "Connect?")) ? "queued" : "none",
      });
      personId = person.id;
      if (created) res.peopleAdded++;
    }
    const excluded = v(r, "US?") === "No";
    if (excluded) res.dismissedNonUs++;
    const leader = category === "New data leader";
    const what = v(r, "Role(s)") ?? v(r, "Summary") ?? "data roles";
    await db.insert(s.signals).values({
      type: leader ? "new_leader" : "hiring_post", category, companyId, personId,
      title: leader ? `${poster ?? "New leader"} joined ${companyName ?? "a company"}${v(r, "Poster Title") ? ` as ${v(r, "Poster Title")}` : ""}` : `${poster ?? companyName ?? "Someone"} is hiring: ${what}`,
      summary: v(r, "Summary"), roles: v(r, "Role(s)"), location: v(r, "Location"), isUs: v(r, "US?"), source: "LinkedIn hiring posts", sourceUrl: v(r, "Post Link"), externalId: postId,
      careerVerified: v(r, "Career Site Verified"), careerPageLink: v(r, "Career Page Link"), searchQuery: v(r, "Search Query"), foundOn: v(r, "Found On"), notes,
      signalDate: parseDate(v(r, "Post Date")) ?? new Date(Number(BigInt(postId) >> BigInt(22))), status: excluded ? "dismissed" : "new", raw: r,
    });
    res.added++;
  }
  return res;
}

// ---------- LinkedIn job alert emails ----------

export async function importJobAlerts(rows: Row[]) {
  const db = await getDb();
  const res = { rows: rows.length, added: 0, alreadyThere: 0, skipped: 0, matchedToAccounts: 0, staffingDropped: 0 };
  for (const r of rows) {
    const jobId = v(r, "jobId") ?? v(r, "url")?.match(/jobs\/view\/(\d+)/)?.[1], title = v(r, "title"), companyName = v(r, "company");
    if (!jobId || !title || !companyName) { res.skipped++; continue; }
    const [dupe] = await db.select({ id: s.jobPostings.id }).from(s.jobPostings).where(eq(s.jobPostings.externalId, jobId));
    if (dupe) { res.alreadyThere++; continue; }
    const [match] = await db.select({ id: s.companies.id }).from(s.companies).where(sql`lower(${s.companies.name}) = ${companyName.toLowerCase()}`).limit(1);
    // Staffing firms and job boards re-post other companies' jobs. Drop them; the archive keeps count.
    if (!match && (await checkStaffing(companyName, "LinkedIn job alerts"))) { res.staffingDropped++; continue; }
    if (match) res.matchedToAccounts++;
    await db.insert(s.jobPostings).values({
      externalId: jobId, title, companyName, companyId: match?.id, location: v(r, "location"), workplace: v(r, "workplace"), salary: v(r, "salary"), url: v(r, "url") ?? `https://www.linkedin.com/jobs/view/${jobId}`,
      alertKind: v(r, "alertKind"), alertSubject: v(r, "alertSubject"), emailThreadId: v(r, "emailThreadId"), receivedAt: parseDate(v(r, "receivedAt")) ?? new Date(),
    });
    res.added++;
  }
  return res;
}

/**
 * Pull the jobs out of one LinkedIn job alert email (plain-text body). Cards are separated by
 * dashed lines; each has title, company, location on its first three lines and a "View job:" link.
 */
export function parseJobAlertEmail(body: string, meta: { subject?: string; threadId?: string; receivedAt?: string }): Row[] {
  const subject = meta.subject ?? "";
  const alertKind = /^new jobs similar to/i.test(subject) ? "similar jobs" : /you may be a fit/i.test(subject) ? "you may be a fit" : /hiring for an? .+ role$/i.test(subject) ? "other" : "job alert";
  const jobs: Row[] = [];
  for (const block of body.split(/\n\s*-{20,}\s*\n/)) {
    const id = block.match(/View job:\s*https?:\/\/\S*\/jobs\/view\/(\d+)/)?.[1];
    if (!id) continue;
    const lines = block.slice(0, block.indexOf("View job:")).split("\n").map((l) => l.trim())
      .filter((l) => l && !/^https?:\/\//.test(l) && !/ jobs$/.test(l) && !/^(your job alert|jobs similar to|expand your search|recommendations based)/i.test(l));
    const [title, company, location] = lines;
    if (!title || !company) continue;
    jobs.push({ jobId: id, title, company, location: location ?? "", workplace: /remote|work from home|wfh/i.test(title) ? "Remote" : "", salary: "", url: `https://www.linkedin.com/jobs/view/${id}`,
      alertSubject: subject, alertKind, emailThreadId: meta.threadId ?? "", receivedAt: meta.receivedAt ?? "" });
  }
  return jobs;
}

export async function listJobPostings(opts: { status?: s.JobPostingStatus } = {}) {
  const db = await getDb();
  return db.select({ job: s.jobPostings, company: s.companies }).from(s.jobPostings).leftJoin(s.companies, eq(s.jobPostings.companyId, s.companies.id))
    .where(opts.status ? eq(s.jobPostings.status, opts.status) : undefined)
    .orderBy(sql`${s.jobPostings.companyId} is null`, sql`${s.jobPostings.receivedAt} desc`).limit(300);
}

export async function setJobPostingStatus(id: number, status: s.JobPostingStatus) {
  await (await getDb()).update(s.jobPostings).set({ status }).where(eq(s.jobPostings.id, id));
}

/** Turn a job posting into an account plus a signal in the inbox. */
export async function promoteJobPosting(id: number) {
  const db = await getDb();
  const [job] = await db.select().from(s.jobPostings).where(eq(s.jobPostings.id, id));
  if (!job) throw new Error(`No job posting with id ${id}`);
  const { company } = await upsertCompany({ name: job.companyName });
  const [dupe] = await db.select({ id: s.signals.id }).from(s.signals).where(eq(s.signals.externalId, `li-job-${job.externalId}`));
  if (!dupe) await db.insert(s.signals).values({ type: "job_alert", category: "Job posting", title: `${job.companyName} posted ${job.title}`, roles: job.title, location: job.location, companyId: company.id,
    source: "LinkedIn job alert", sourceUrl: job.url, externalId: `li-job-${job.externalId}`, signalDate: job.receivedAt, status: "kept" });
  await db.update(s.jobPostings).set({ status: "kept", companyId: company.id }).where(eq(s.jobPostings.id, id));
  return company;
}

// ---------- LinkedIn Connections export ----------

/** Small CSV reader: handles quoted fields, embedded commas and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c; }
    else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function csvToRows(text: string, headerHas: string): Row[] {
  const grid = parseCsv(text.replace(/^﻿/, ""));
  const h = grid.findIndex((r) => r.some((c) => c.trim() === headerHas));
  if (h < 0) throw new Error(`This file has no "${headerHas}" column, so it does not look like the right export.`);
  const header = grid[h].map((c) => c.trim());
  return grid.slice(h + 1).filter((r) => r.some((c) => c.trim())).map((r) => Object.fromEntries(header.map((k, i) => [k, r[i] ?? ""])));
}

/**
 * Check who has accepted, using LinkedIn's own export (Settings, Data privacy, Get a copy of
 * your data, Connections). Nothing here signs in to LinkedIn or reads its pages.
 */
export async function importLinkedInConnections(csv: string) {
  const db = await getDb();
  const rows = csvToRows(csv, "URL");
  const res = { connectionsInFile: rows.length, newlyConnected: 0, alreadyConnected: 0, notInApp: 0, names: [] as string[] };
  for (const r of rows) {
    const url = normalizeLinkedIn(r["URL"]);
    const [person] = url ? await db.select().from(s.people).where(eq(s.people.linkedinUrl, url)) : [];
    if (!person) { res.notInApp++; continue; }
    if (person.connectionStatus === "connected") { res.alreadyConnected++; continue; }
    const at = parseDate(r["Connected On"]) ?? new Date();
    await db.update(s.people).set({ connectionStatus: "connected", connectedAt: at }).where(eq(s.people.id, person.id));
    await db.insert(s.activities).values({ type: "linkedin", outcome: "connected", personId: person.id, companyId: person.companyId, occurredAt: at, notes: "Found in LinkedIn Connections export" });
    res.newlyConnected++;
    if (res.names.length < 10) res.names.push(person.name);
  }
  return res;
}

/** After a firm is confirmed as staffing, remove what it already put in the app's inboxes. */
export async function purgeStaffing() {
  const db = await getDb();
  const firms = (await db.select().from(s.staffingFirms)).filter((f) => f.status !== "not_staffing");
  const keys = new Set(firms.map((f) => f.nameKey));
  const { staffingKey } = await import("./staffing");
  let jobs = 0;
  for (const j of await db.select({ id: s.jobPostings.id, name: s.jobPostings.companyName, companyId: s.jobPostings.companyId }).from(s.jobPostings)) {
    if (!j.companyId && keys.has(staffingKey(j.name))) { await db.delete(s.jobPostings).where(eq(s.jobPostings.id, j.id)); jobs++; }
  }
  return { jobsRemoved: jobs };
}
