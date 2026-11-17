/**
 * The decision layer: turns scores into a short list of what to do next, each with its reason.
 *
 * The views say how strong the case is (company_heat, person_heat). The rules below say what
 * the right move is given where things stand with that person or company. They are plain code
 * on purpose: every recommendation can be traced to one rule and the signals behind it.
 *
 * Nothing here acts. Each action is a suggestion with a button; Adrian presses it.
 */
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { allCompanyHeat, allPersonHeat, type CompanyHeat, type PersonHeat } from "./signals";

export type ActionKind = "follow_up" | "message" | "send_request" | "connect" | "call" | "add_to_call_list" | "research" | "find_contact";
export type NextAction = {
  key: string; kind: ActionKind; headline: string; when: "Today" | "This week";
  /** Rank. Roughly: how sure we are this is worth doing now. */
  score: number; why: string[];
  company: { id: number; name: string }; person: (typeof s.people.$inferSelect) | null; queueId?: number;
  /** Set when Claude has already written the message and it is waiting for review. */
  draftReady?: boolean;
};

const DAY = 86_400_000;
const daysSince = (d: Date | null | undefined) => (d ? (Date.now() - d.getTime()) / DAY : Infinity);
const ago = (days: number) => (days < 1 ? "today" : days < 2 ? "yesterday" : `${Math.floor(days)} days ago`);

// The thresholds, in one place.
const RULES = {
  /** A person needs at least this much heat before we suggest connecting cold. */
  connectMinHeat: 12,
  /** A LinkedIn request with no answer after this many days: stop waiting, call. */
  requestStaleDays: 7,
  /** After they accept, a first message is worth sending within this window. */
  messageWindowDays: 21,
  /** A company needs this priority (heat + fit) before we suggest adding it to the call list. */
  callListMinPriority: 45,
  /** ...and some real heat: fit alone is never a reason to call. */
  callListMinHeat: 12,
  /** After a real conversation, follow up within this many days. */
  followUpWithinDays: 5,
};

export async function getNextActions(opts: { limit?: number; kind?: ActionKind } = {}): Promise<NextAction[]> {
  const db = await getDb();
  const [companies, people, queue, phones, drafts, followUpDrafts, emails, companyHeat, personHeat] = await Promise.all([
    db.select().from(s.companies),
    db.select().from(s.people).where(eq(s.people.type, "decision_maker")),
    db.select().from(s.callQueue),
    db.select({ companyId: s.phoneNumbers.companyId, status: s.phoneNumbers.status }).from(s.phoneNumbers),
    db.select({ personId: s.drafts.personId }).from(s.drafts).where(and(eq(s.drafts.kind, "linkedin_message"), isNotNull(s.drafts.personId))),
    db.select({ companyId: s.drafts.companyId, personId: s.drafts.personId }).from(s.drafts).where(and(eq(s.drafts.kind, "follow_up"), inArray(s.drafts.status, ["draft", "approved"]))),
    db.select({ companyId: s.activities.companyId, at: s.activities.occurredAt }).from(s.activities).where(inArray(s.activities.type, ["email", "meeting"])),
    allCompanyHeat(), allPersonHeat(),
  ]);
  const company = new Map(companies.map((c) => [c.id, c]));
  const cHeat = new Map(companyHeat.map((h) => [h.company_id, h]));
  const pHeat = new Map(personHeat.map((h) => [h.person_id, h]));
  const queueByCompany = new Map(queue.map((q) => [q.companyId, q]));
  const dialable = new Set(phones.filter((p) => p.status !== "bad" && p.status !== "do_not_call").map((p) => p.companyId));
  const hasDraft = new Set(drafts.map((d) => d.personId));
  const peopleByCompany = new Map<number, typeof people>();
  for (const p of people) if (p.companyId) peopleByCompany.set(p.companyId, [...(peopleByCompany.get(p.companyId) ?? []), p]);
  const zeroC: Omit<CompanyHeat, "company_id"> = { heat: 0, fit: 0, priority: 0, signal_count: 0, last_signal_at: null, top_reasons: [] };

  const actions: NextAction[] = [];
  const add = (a: Omit<NextAction, "company"> & { companyId: number }) => {
    const c = company.get(a.companyId);
    if (!c || c.status === "do_not_contact") return; // never suggest contacting a do-not-contact company
    actions.push({ ...a, company: { id: c.id, name: c.name } });
  };

  // ---- People: where does the LinkedIn relationship stand, and is there a reason to move it on?
  for (const p of people) {
    if (!p.companyId) continue;
    const ph: PersonHeat | undefined = pHeat.get(p.id);
    const ch = cHeat.get(p.companyId) ?? zeroC;
    const reasons = [...new Set(ph?.top_reasons ?? [])].map((r, i) => (i === 0 && ph ? `${r} (${ago(ph.freshest_days)})` : r));
    const q = queueByCompany.get(p.companyId);

    if (p.connectionStatus === "connected" && daysSince(p.connectedAt) <= RULES.messageWindowDays && !hasDraft.has(p.id)) {
      // Rule 1. They accepted: the window to start a conversation is open and closes fast.
      add({ key: `p${p.id}`, kind: "message", headline: `Send ${p.name} a first message`, when: "Today", score: 80 + (ph?.heat ?? 0) * 0.3, companyId: p.companyId, person: p,
        why: [`Accepted your connection request ${ago(daysSince(p.connectedAt))}`, ...reasons.slice(0, 2)] });
    } else if (p.connectionStatus === "note_ready") {
      // Rule 2. A note is written and waiting. Sending it is one click.
      add({ key: `p${p.id}`, kind: "send_request", headline: `Send the connection request to ${p.name}`, when: "Today", score: 60 + (ph?.heat ?? 0) * 0.3, companyId: p.companyId, person: p,
        why: ["A connection note is written and ready", ...reasons.slice(0, 2)] });
    } else if (p.connectionStatus === "sent" && daysSince(p.connectionRequestedAt) > RULES.requestStaleDays && dialable.has(p.companyId)) {
      // Rule 3. No answer on LinkedIn after a week: change channel.
      add({ key: `p${p.id}`, kind: q ? "call" : "add_to_call_list", headline: q ? `Call ${p.name}: no reply on LinkedIn` : `Add ${company.get(p.companyId)?.name} to the call list: no reply on LinkedIn`,
        when: "This week", score: 35 + ch.priority * 0.3, companyId: p.companyId, person: p, queueId: q?.id,
        why: [`Connection request sent ${ago(daysSince(p.connectionRequestedAt))} with no answer`, ...reasons.slice(0, 2)] });
    } else if (p.connectionStatus === "none" && p.linkedinUrl && ph && ph.heat >= RULES.connectMinHeat) {
      // Rule 4. A person-level signal and no relationship yet: connect while the signal is fresh.
      const fresh = ph.freshest_days <= 7;
      add({ key: `p${p.id}`, kind: "connect", headline: `Connect with ${p.name}`, when: fresh ? "Today" : "This week", score: ph.heat + ch.heat * 0.25 + ch.fit * 0.2, companyId: p.companyId, person: p,
        why: [...reasons, ...(ch.fit >= 25 ? ["Company fits: thin recruiting team, right size"] : [])].slice(0, 3) });
    }
  }

  // ---- Companies: where does the call list stand?
  for (const c of companies) {
    const ch = cHeat.get(c.id) ?? zeroC;
    const q = queueByCompany.get(c.id);
    const contacts = peopleByCompany.get(c.id) ?? [];
    const lead = contacts.find((p) => p.id === q?.personId) ?? contacts[0] ?? null;

    if (q && q.status === "connected" && daysSince(q.lastContactAt) <= 30) {
      // Rule 5. We spoke, or they asked for an email, and nothing has gone out since.
      const followedUp = emails.some((e) => e.companyId === c.id && q.lastContactAt && e.at.getTime() >= q.lastContactAt.getTime());
      // If they asked us to come back later, respect the date instead of nudging now.
      const parked = !!q.nextStepDate && q.nextStepDate.getTime() > Date.now() + 3 * DAY;
      const drafted = followUpDrafts.some((d) => d.companyId === c.id || (!!lead && d.personId === lead.id));
      if (!followedUp && !parked) add({ key: `c${c.id}:follow`, kind: "follow_up", draftReady: drafted, headline: drafted ? `Review and send the follow-up to ${lead?.name ?? c.name}` : `Follow up with ${lead?.name ?? c.name}`, when: daysSince(q.lastContactAt) <= RULES.followUpWithinDays ? "Today" : "This week",
        score: 90 - Math.min(20, daysSince(q.lastContactAt)), companyId: c.id, person: lead, queueId: q.id,
        why: [`${q.sourceStatus === "E-mail Requested" ? "Asked for an email" : "Spoke with us"} ${ago(daysSince(q.lastContactAt))} and no follow-up is logged`, ...ch.top_reasons.filter((r) => !/^(Spoke with us|Asked for an email|Booked a meeting)/.test(r)).slice(0, 2)] });
    } else if (q && q.status === "needs_info") {
      // Rule 6. Stuck on a bad number or the wrong contact: research unblocks it.
      if (ch.heat > 0) add({ key: `c${c.id}:research`, kind: "research", headline: `Find a working number or the right contact at ${c.name}`, when: "This week", score: 20 + ch.priority * 0.4, companyId: c.id, person: lead, queueId: q.id,
        why: [q.sourceStatus ? `Call sheet says: ${q.sourceStatus}` : "The last call hit a bad number or the wrong person", ...ch.top_reasons.slice(0, 2)] });
    } else if (!q && ch.priority >= RULES.callListMinPriority && ch.heat >= RULES.callListMinHeat) {
      // Rule 7. Hot and a good fit, but nobody is calling it yet.
      if (contacts.length === 0) add({ key: `c${c.id}:contact`, kind: "find_contact", headline: `Find a decision maker at ${c.name}`, when: "This week", score: ch.priority * 0.6, companyId: c.id, person: null, why: ch.top_reasons.slice(0, 3) });
      else if (dialable.has(c.id)) add({ key: `c${c.id}:list`, kind: "add_to_call_list", headline: `Add ${c.name} to the call list`, when: "This week", score: ch.priority * 0.7, companyId: c.id, person: lead, why: ch.top_reasons.slice(0, 3) });
    }
  }

  const ranked = actions.filter((a) => !opts.kind || a.kind === opts.kind).sort((a, b) => b.score - a.score);
  return ranked.slice(0, opts.limit ?? 50).map((a) => ({ ...a, score: Math.round(a.score) }));
}

export type BatchKind = "briefs" | "notes" | "research" | "follow_ups";
/**
 * Queue a batch of work for Claude from the top of the to-do list: briefs for the strongest
 * companies that have none, connection notes for the best people to connect with, numbers for
 * rows stuck on a bad one, and drafts for follow-ups that are owed.
 */
export async function queueBatch(kind: BatchKind, count: number) {
  const db = await getDb();
  const { queueJob, queueConnection } = await import("./index");
  const n = Math.max(1, Math.min(50, count));
  let queued = 0;
  if (kind === "briefs") {
    const heat = (await allCompanyHeat()).filter((h) => h.heat > 0).sort((a, b) => b.priority - a.priority);
    const without = new Set((await db.select({ id: s.companies.id, brief: s.companies.brief, status: s.companies.status }).from(s.companies)).filter((c) => !c.brief && c.status !== "do_not_contact").map((c) => c.id));
    const names = new Map((await db.select({ id: s.companies.id, name: s.companies.name }).from(s.companies)).map((c) => [c.id, c.name]));
    for (const h of heat.filter((x) => without.has(x.company_id)).slice(0, n)) { await queueJob({ kind: "company_brief", title: `Write the brief for ${names.get(h.company_id)}`, payload: { companyId: h.company_id } }); queued++; }
    return queued;
  }
  const actions = await getNextActions({ limit: 400 });
  if (kind === "notes") for (const a of actions.filter((x) => x.kind === "connect" && x.person && !x.person.connectionNote).slice(0, n)) { await queueConnection(a.person!.id); queued++; }
  if (kind === "research") for (const a of actions.filter((x) => x.kind === "research").slice(0, n)) { await queueJob({ kind: "phone_research", title: `Ask Claude to research: ${a.person?.name ?? a.company.name}`, payload: { companyId: a.company.id, personId: a.person?.id ?? null } }); queued++; }
  if (kind === "follow_ups") for (const a of actions.filter((x) => x.kind === "follow_up" && !x.draftReady).slice(0, n)) { await queueJob({ kind: "draft_follow_up", title: `Ask Claude to draft the follow-up: ${a.person?.name ?? a.company.name}`, payload: { companyId: a.company.id, personId: a.person?.id ?? null } }); queued++; }
  return queued;
}
