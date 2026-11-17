/**
 * The candidate side of "what should I do next": for each open role, who to reach, who to
 * nudge, who to screen and who to submit, each with the reason and the words ready to send.
 *
 * Same idea as src/core/decisions.ts for business development: plain rules, one suggestion per
 * candidate and role, nothing acted on until a button is pressed.
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { candidatesReady } from "./candidates";
import { matchRole, type Match } from "./matching";
import { feeler, type Feeler } from "./outreach";

export type CandidateActionKind = "reach_out" | "nudge" | "screen" | "check_call" | "submit" | "compile";
export type CandidateAction = {
  key: string; kind: CandidateActionKind; headline: string; when: "Today" | "This week"; score: number; why: string[];
  person: typeof s.people.$inferSelect; role: { id: number; title: string; client: string } | null; match?: Match; feeler?: Feeler; callId?: number;
};

const DAY = 86_400_000;
const RULES = {
  /** Only suggest reaching out to people who meet every must-have and score at least this. */
  reachOutMinScore: 70,
  /** No reply after this many days: nudge once. */
  nudgeAfterDays: 5,
  /** After a screen, a match at or above this is worth putting in front of the client. */
  submitMinScore: 80,
};

export async function getCandidateActions(opts: { limit?: number; searchId?: number } = {}): Promise<CandidateAction[]> {
  await candidatesReady();
  const db = await getDb();
  const roles = (await db.select().from(s.searches).where(eq(s.searches.status, "open"))).filter((r) => !opts.searchId || r.id === opts.searchId);
  const [people, links, touches, calls, uncompiled] = await Promise.all([
    db.select().from(s.people).where(eq(s.people.type, "candidate")),
    db.select().from(s.searchCandidates),
    db.select().from(s.activities).where(inArray(s.activities.type, ["linkedin", "email", "text", "screen_call"])),
    db.select().from(s.screenCalls),
    db.select({ personId: s.candidateSources.personId }).from(s.candidateSources).where(isNull(s.candidateSources.compiledAt)),
  ]);
  const person = new Map(people.map((p) => [p.id, p]));
  const actions: CandidateAction[] = [];
  const ago = (d: Date) => { const n = Math.floor((Date.now() - d.getTime()) / DAY); return n < 1 ? "today" : n === 1 ? "yesterday" : `${n} days ago`; };

  for (const role of roles) {
    const client = role.clientName ?? "the client";
    const r = { id: role.id, title: role.title, client };
    for (const m of await matchRole(role.id, 40)) {
      const p = person.get(m.personId);
      if (!p) continue;
      const link = links.find((l) => l.searchId === role.id && l.personId === p.id);
      if (link && ["rejected", "placed", "offer", "interview", "submitted"].includes(link.stage)) continue;
      const mine = touches.filter((t) => t.personId === p.id && t.searchId === role.id).sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
      const last = mine[0];
      const call = calls.filter((c) => c.personId === p.id && c.searchId === role.id).sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime())[0];
      const tools = m.tools.filter((t) => t.must && t.has >= t.need).slice(0, 3).map((t) => `${t.name} ${t.has}y`).join(", ");
      const fit = [`Scores ${m.score} for ${role.title}${tools ? `: ${tools}` : ""}`, ...m.parts.filter((x) => x.score < 0.4).slice(0, 1).map((x) => `Watch: ${x.note}`)];
      const base = { person: p, role: r, match: m };

      if (call && (call.status === "requested" || call.status === "in_progress")) {
        // A call is out: see whether it has finished.
        actions.push({ ...base, key: `${role.id}:${p.id}`, kind: "check_call", headline: `Check ${p.name}'s AI screen call`, when: "Today", score: 95, callId: call.id, why: [`Call placed ${ago(call.requestedAt)}`, ...fit.slice(0, 1)] });
      } else if (link?.stage === "screened" && m.score >= RULES.submitMinScore && m.missingMust.length === 0) {
        // Screened and strong: the client should see them.
        actions.push({ ...base, key: `${role.id}:${p.id}`, kind: "submit", headline: `Submit ${p.name} to ${client}`, when: "Today", score: 90 + m.score / 10, why: ["Screened and still a strong match", ...fit] });
      } else if (link?.stage === "contacted" && p.aiContactConsent && p.phone && (!call || call.status === "not_connected" || call.status === "failed")) {
        // They answered and agreed to a call: screen them while they are warm.
        actions.push({ ...base, key: `${role.id}:${p.id}`, kind: "screen", headline: `Start ${p.name}'s AI screen call`, when: "Today", score: 85 + m.score / 10, why: [`Agreed to a call: ${p.consentNote ?? "consent on file"}`, ...fit] });
      } else if (last && last.outcome === "feeler" && Date.now() - last.occurredAt.getTime() > RULES.nudgeAfterDays * DAY && mine.filter((t) => t.outcome === "feeler").length < 2) {
        // One nudge, on a different channel if there is one. Never a third message.
        actions.push({ ...base, key: `${role.id}:${p.id}`, kind: "nudge", headline: `Follow up with ${p.name} about ${role.title}`, when: "This week", score: 50 + m.score / 5, feeler: undefined, why: [`${last.notes ?? "Reached out"} ${ago(last.occurredAt)}, no reply logged`, ...fit.slice(0, 1)] });
      } else if (!last && m.missingMust.length === 0 && m.score >= RULES.reachOutMinScore) {
        // A good match nobody has contacted about this role.
        actions.push({ ...base, key: `${role.id}:${p.id}`, kind: "reach_out", headline: `Reach out to ${p.name} about ${role.title}`, when: m.score >= 85 ? "Today" : "This week", score: m.score * 0.8, why: fit });
      }
    }
  }

  // Pitch each person their best role only, not three at once.
  const best = new Map<number, CandidateAction>();
  const rest: CandidateAction[] = [];
  for (const a of actions) {
    if (a.kind !== "reach_out") { rest.push(a); continue; }
    const cur = best.get(a.person.id);
    if (!cur || a.score > cur.score) best.set(a.person.id, a);
  }
  const busy = new Set(rest.map((a) => a.person.id));
  const out = [...rest, ...[...best.values()].filter((a) => !busy.has(a.person.id))];

  // Raw material waiting to be worked into a profile.
  for (const id of new Set(uncompiled.map((u) => u.personId))) {
    const p = person.get(id);
    if (p) out.push({ key: `compile:${id}`, kind: "compile", headline: `Compile ${p.name}'s profile`, when: "This week", score: 40, person: p, role: null, why: ["New material has been added and is not in the profile yet"] });
  }

  // Attach the ready-to-send words for anything that involves writing to the person.
  const profiles = new Map((await db.select().from(s.candidateProfiles).where(inArray(s.candidateProfiles.personId, out.length ? out.map((a) => a.person.id) : [0]))).map((c) => [c.personId, c.profile]));
  const roleById = new Map(roles.map((x) => [x.id, x]));
  for (const a of out) if (a.role && profiles.get(a.person.id)) a.feeler = feeler(a.person.name, profiles.get(a.person.id)!, roleById.get(a.role.id)!);

  return out.sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 60).map((a) => ({ ...a, score: Math.round(a.score) }));
}

/** Everything needed to reach one candidate about one role: the words and where they stand. */
export async function outreachFor(personId: number, searchId: number) {
  const db = await getDb();
  const [[cp], [role], [person], touches] = await Promise.all([
    db.select().from(s.candidateProfiles).where(eq(s.candidateProfiles.personId, personId)),
    db.select().from(s.searches).where(eq(s.searches.id, searchId)),
    db.select().from(s.people).where(eq(s.people.id, personId)),
    db.select().from(s.activities).where(and(eq(s.activities.personId, personId), eq(s.activities.searchId, searchId))),
  ]);
  if (!cp || !role || !person) return null;
  return { person, role, feeler: feeler(person.name, cp.profile, role), touches: touches.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()) };
}
