/**
 * Candidate outreach: the words for a first "feeler" about a role, on each channel, and the
 * record of having reached out.
 *
 * Nothing here sends anything. A button copies the words and opens LinkedIn, Gmail or the
 * messaging app with them filled in; Adrian presses send there. The one exception is the AI
 * screen call, which places a call, and that is locked until the candidate has agreed to one.
 */
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { getScreenCall, retellConfigured, startScreenCall, toE164, RetellError } from "@/connectors/retell";
import { SIZE_LABEL, canonTool, toolYears, type Profile } from "./candidate-schema";
import { addCandidateSource, addToSearch } from "./candidates";
import { setConnectionStatus } from "./index";
import type { Requirements } from "./matching";

export type Feeler = { note: string; message: string; emailSubject: string; emailBody: string; text: string };
type RoleLike = { title: string; requirements: Requirements | null; compRange?: string | null };

const an = (x: string) => `${/^[aeiou]/i.test(x) ? "an" : "a"} ${x}`;
const SIGN = "Adrian, SheerFlow";

/**
 * A first message about a role, written from what we know of the person and the role. The client
 * is described, never named. Plain and short on purpose; ask Claude for a more personal version.
 */
export function feeler(name: string, profile: Profile, role: RoleLike): Feeler {
  const first = name.split(" ")[0];
  const req = role.requirements ?? { tools: [] };
  const years = toolYears(profile);
  const musts = req.tools.filter((t) => t.must).map((t) => t.name);
  const shared = musts.filter((t) => years.has(canonTool(t)) && t !== "SQL");
  const size = req.companySize ? SIZE_LABEL[req.companySize].split(" (")[0].toLowerCase() : "";
  const client = `${an(`${size} company`.trim())}`;
  const where = req.workplace === "remote" ? "remote" : req.workplace ? `${req.workplace}${req.city ? ` in ${req.city}` : ""}` : "";
  const pay = req.maxBase ? `up to $${Math.round(req.maxBase / 1000)}k` : "";
  const terms = [where, pay].filter(Boolean).join(", ");
  const stack = musts.filter((t) => t !== "SQL").slice(0, 3).join(", ");
  const title = role.title.replace(/\s*\(.*\)$/, "");
  const hook = shared.length ? `your ${shared.slice(0, 2).map((t) => `${t}`).join(" and ")} work${profile.experience[0] ? ` at ${profile.experience[0].company}` : ""}` : `your background${profile.experience[0] ? ` at ${profile.experience[0].company}` : ""}`;

  // LinkedIn caps a connection note at 300 characters: drop detail until it fits.
  const noteParts = [`Hi ${first}, I place data people only.`, `A client (${client}) is hiring ${an(title)}${stack ? `: ${stack}` : ""}${terms ? `; ${terms}` : ""}.`, `${hook[0].toUpperCase()}${hook.slice(1)} looks close.`, "Open to hearing more?"];
  let note = noteParts.join(" ");
  if (note.length > 300) note = [noteParts[0], `A client is hiring ${an(title)}${terms ? ` (${terms})` : ""}.`, noteParts[3]].join(" ");
  if (note.length > 300) note = `Hi ${first}, I place data people only and have ${an(title)} role that looks like a fit. Open to hearing more?`.slice(0, 300);

  const body = [
    `I run SheerFlow, a small firm that only places data engineers, analytics engineers and BI people.`,
    `I'm working with ${client} that is hiring ${an(title)}.${stack ? ` The work centers on ${stack}.` : ""}${terms ? ` It is ${terms}.` : ""}`,
    `I'm reaching out because of ${hook}${shared.length ? `, which is what they asked for first` : ""}.`,
    `If it's worth a look, I can send the details or we can talk for ten minutes. If the timing is wrong, tell me and I'll leave you be.`,
  ];
  return {
    note,
    message: `Hi ${first},\n\n${body.join("\n\n")}\n\n${SIGN}`,
    emailSubject: `${title} role${where ? ` (${where})` : ""}`,
    emailBody: `Hi ${first},\n\n${body.join("\n\n")}\n\n${SIGN}`,
    text: `Hi ${first}, this is Adrian from SheerFlow. I have ${an(title)} role${terms ? ` (${terms})` : ""} that fits ${hook}. OK if I send details? Reply STOP and I won't text again.`,
  };
}

export type Channel = "linkedin_connect" | "linkedin_message" | "email" | "text";
const CHANNEL: Record<Channel, [s.ActivityType, string]> = { linkedin_connect: ["linkedin", "Connection request with a note about the role"], linkedin_message: ["linkedin", "Message about the role"], email: ["email", "Email about the role"], text: ["text", "Text about the role"] };

/**
 * Record that Adrian reached out about a role. The app opened the message for him to send; this
 * keeps the trail, puts the person in the role's pipeline and moves them to "contacted".
 */
export async function logOutreach(personId: number, searchId: number, channel: Channel) {
  const db = await getDb();
  const [type, what] = CHANNEL[channel];
  await db.insert(s.activities).values({ type, outcome: "feeler", personId, searchId, notes: what });
  const link = await addToSearch(searchId, personId);
  if (link.stage === "sourced") await db.update(s.searchCandidates).set({ stage: "contacted" }).where(eq(s.searchCandidates.id, link.id));
  if (channel === "linkedin_connect") await setConnectionStatus(personId, "sent");
}

/** Record whether the person has agreed to an automated call or text, and how we know. */
export async function setConsent(personId: number, agreed: boolean, note?: string) {
  await (await getDb()).update(s.people).set({ aiContactConsent: agreed, consentNote: agreed ? note?.trim() || "Agreed (no detail recorded)" : null }).where(eq(s.people.id, personId));
}

/** What the AI screener is told before it dials: the role and the questions that fill the gaps. */
export function screenBrief(name: string, role: RoleLike): Record<string, string> {
  const req = role.requirements ?? { tools: [] };
  const musts = req.tools.filter((t) => t.must);
  return {
    candidate_name: name, role_title: role.title.replace(/\s*\(.*\)$/, ""),
    company_description: req.companySize ? `${an(SIZE_LABEL[req.companySize].split(" (")[0].toLowerCase())} company` : "a client company",
    must_have_tools: musts.map((t) => `${t.name} (${t.minYears}+ years)`).join(", "),
    tool_questions: musts.map((t) => `How many years have you used ${t.name}, and when did you last use it day to day?`).join(" | "),
    location_and_pay: [req.workplace, req.city, req.maxBase ? `pays up to $${Math.round(req.maxBase / 1000)}k` : ""].filter(Boolean).join(", "),
  };
}

/** Ask for an AI screen call. Refused without consent or a phone number. Without Retell keys, it records the request and places no call. */
export async function requestScreenCall(personId: number, searchId: number) {
  const db = await getDb();
  const [person] = await db.select().from(s.people).where(eq(s.people.id, personId));
  const [role] = await db.select().from(s.searches).where(eq(s.searches.id, searchId));
  if (!person || !role) throw new Error("That candidate or role no longer exists");
  if (!person.aiContactConsent) throw new Error(`${person.name} has not agreed to an automated call. Record their consent on their profile first.`);
  const to = person.phone ? toE164(person.phone) : null;
  if (!to) throw new Error(`${person.name} has no usable phone number on file`);
  const brief = screenBrief(person.name, role);
  let status: s.ScreenCallStatus = "not_connected", providerCallId: string | null = null, detail = "Retell is not connected, so no call was placed. Add the Retell keys to go live.";
  if (retellConfigured()) {
    try { const r = await startScreenCall(to, brief); status = "requested"; providerCallId = r.callId; detail = `Call placed (${r.status}).`; }
    catch (e) { if (!(e instanceof RetellError)) throw e; status = "failed"; detail = e.message; }
  }
  const [call] = await db.insert(s.screenCalls).values({ personId, searchId, status, toNumber: to, brief, providerCallId, detail }).returning();
  if (status === "requested") {
    await db.insert(s.activities).values({ type: "screen_call", outcome: "requested", personId, searchId, notes: "AI screen call placed" });
    await addToSearch(searchId, personId);
  }
  return call;
}

/** Check a placed call. When it has ended, its transcript becomes a source on the candidate and is queued for compiling. */
export async function refreshScreenCall(callId: number) {
  const db = await getDb();
  const [call] = await db.select().from(s.screenCalls).where(eq(s.screenCalls.id, callId));
  if (!call?.providerCallId || call.status === "completed") return call;
  const r = await getScreenCall(call.providerCallId);
  if (!r.transcript) { await db.update(s.screenCalls).set({ status: r.status === "ended" ? "failed" : "in_progress", detail: `Retell says: ${r.status}` }).where(eq(s.screenCalls.id, callId)); return call; }
  await db.update(s.screenCalls).set({ status: "completed", transcript: r.transcript, summary: r.summary, completedAt: new Date(), detail: "Transcript received" }).where(eq(s.screenCalls.id, callId));
  await addCandidateSource({ personId: call.personId, kind: "screen_call", title: "Retell AI screen call", content: `${r.summary ? `Summary: ${r.summary}\n\n` : ""}${r.transcript}` });
  if (call.searchId) {
    const [link] = await db.select().from(s.searchCandidates).where(and(eq(s.searchCandidates.searchId, call.searchId), eq(s.searchCandidates.personId, call.personId)));
    if (link && (link.stage === "sourced" || link.stage === "contacted")) await db.update(s.searchCandidates).set({ stage: "screened" }).where(eq(s.searchCandidates.id, link.id));
  }
  return call;
}

export async function listScreenCalls(personId: number) {
  return (await getDb()).select().from(s.screenCalls).where(eq(s.screenCalls.personId, personId)).orderBy(desc(s.screenCalls.requestedAt));
}
