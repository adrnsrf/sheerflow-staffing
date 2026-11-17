/**
 * Outreach over time: who has already been worked, what was done, and what comes next.
 *
 * Every touch (call, LinkedIn request, email, text, a note Claude wrote) is one row in the
 * outreach_touches view. From those, each worked person gets a place in a simple cadence:
 * waiting on them, due for the next step, answered, or finished. Nothing here acts; it tells
 * Adrian where each person stands so nobody is contacted twice by accident or forgotten.
 */
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";

const DAY = 86_400_000;

/** How long to wait on each channel before the next step, and how many tries before stopping. */
export const CADENCE = {
  linkedinAcceptDays: 7,   // a connection request with no accept: after this, change channel
  emailReplyDays: 5,       // an email or message with no reply: after this, one follow-up
  callBackDays: 2,         // a voicemail or no answer: call back after this
  maxContacts: 4,          // after this many tries with no response, stop
  restDays: 30,            // then leave them alone at least this long
  weeklyLinkedInLimit: 80, // LinkedIn's rough weekly cap on connection requests; stay well under
  dailyConnects: 15, dailyFollowUps: 10, dailyCalls: 20,
};

export type Touch = { touch_id: string; person_id: number | null; company_id: number | null; search_id: number | null; channel: string; outcome: string; notes: string | null; at: Date; contacted: boolean; responded: boolean };
export type Standing = "answer" | "due" | "waiting" | "finished";
export type Progress = {
  personId: number; name: string; title: string | null; type: string; companyId: number | null; company: string | null; linkedinUrl: string | null; connectionStatus: string;
  contacts: number; firstContactAt: Date | null; lastContactAt: Date | null; lastChannel: string | null; lastOutcome: string | null; responded: boolean;
  standing: Standing; next: string; dueAt: Date | null; touches: Touch[];
};

const dates = <T extends Record<string, unknown>>(rows: T[], cols: string[]) => rows.map((r) => { for (const k of cols) if (typeof r[k] === "string") (r as Record<string, unknown>)[k] = new Date(r[k] as string); return r; });
const CHANNEL: Record<string, string> = { call: "Call", linkedin: "LinkedIn", email: "Email", text: "Text", meeting: "Meeting", screen_call: "AI screen call", claude: "Claude", note: "Note" };
export const channelLabel = (c: string) => CHANNEL[c] ?? c;

/** Where one person stands and what the next step is, from their last contact. */
function stand(r: { contacts: number; last_contact_at: Date | null; last_channel: string | null; last_outcome: string | null; responded: boolean; responded_at: Date | null; connection_status: string }): { standing: Standing; next: string; dueAt: Date | null } {
  const last = r.last_contact_at;
  const after = (days: number) => (last ? new Date(last.getTime() + days * DAY) : null);
  const due = (d: Date | null) => !!d && d.getTime() <= Date.now();
  if (r.responded && r.responded_at && (!last || r.responded_at.getTime() >= last.getTime() - 60_000)) return { standing: "answer", next: "They responded: answer them", dueAt: r.responded_at };
  if (!last) return { standing: "due", next: "Nothing sent yet", dueAt: null };
  if (r.contacts >= CADENCE.maxContacts && !r.responded) return { standing: "finished", next: `Tried ${r.contacts} times with no answer: leave them until ${after(CADENCE.restDays)!.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, dueAt: after(CADENCE.restDays) };
  if (r.last_channel === "linkedin" && r.connection_status === "sent") { const d = after(CADENCE.linkedinAcceptDays); return due(d) ? { standing: "due", next: "No accept on LinkedIn: try a call or an email", dueAt: d } : { standing: "waiting", next: "Waiting for them to accept on LinkedIn", dueAt: d }; }
  if (r.last_channel === "linkedin" && r.connection_status === "connected") return { standing: "due", next: "Connected on LinkedIn: send a first message", dueAt: last };
  if (r.last_channel === "call") { const d = after(CADENCE.callBackDays); return ["voicemail", "no_answer", "gatekeeper"].includes(r.last_outcome ?? "") ? (due(d) ? { standing: "due", next: "Call back", dueAt: d } : { standing: "waiting", next: "Call back", dueAt: d }) : { standing: "finished", next: `Last call: ${(r.last_outcome ?? "").replace(/_/g, " ")}`, dueAt: null }; }
  const d = after(CADENCE.emailReplyDays);
  return due(d) ? { standing: "due", next: "No reply: send one follow-up, or try another channel", dueAt: d } : { standing: "waiting", next: "Waiting for a reply", dueAt: d };
}

/** Everyone who has been contacted, with where they stand. Newest activity first. */
export async function listProgress(opts: { days?: number } = {}): Promise<Progress[]> {
  const db = await getDb();
  const since = new Date(Date.now() - (opts.days ?? 60) * DAY).toISOString();
  const rows = dates((await db.execute(sql`
    select o.*, p.name, p.title, p.type, p.company_id, p.linkedin_url, p.connection_status, c.name as company
    from person_outreach o join people p on p.id = o.person_id left join companies c on c.id = p.company_id
    where o.contacts > 0 and o.last_touch_at >= ${since}::timestamptz and coalesce(c.status, 'prospect') <> 'do_not_contact'
    order by o.last_touch_at desc limit 400`)).rows as Record<string, unknown>[], ["first_contact_at", "last_contact_at", "last_touch_at", "responded_at"]) as never as (Record<string, never> & { person_id: number })[];
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.person_id);
  const touches = dates((await db.execute(sql`select * from outreach_touches where person_id in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)}) order by at desc`)).rows as Record<string, unknown>[], ["at"]) as unknown as Touch[];
  return rows.map((r) => {
    const x = r as unknown as { person_id: number; name: string; title: string | null; type: string; company_id: number | null; company: string | null; linkedin_url: string | null; connection_status: string; contacts: number; first_contact_at: Date | null; last_contact_at: Date | null; last_channel: string | null; last_outcome: string | null; responded: boolean; responded_at: Date | null };
    return { personId: x.person_id, name: x.name, title: x.title, type: x.type, companyId: x.company_id, company: x.company, linkedinUrl: x.linkedin_url, connectionStatus: x.connection_status, contacts: x.contacts, firstContactAt: x.first_contact_at, lastContactAt: x.last_contact_at, lastChannel: x.last_channel, lastOutcome: x.last_outcome, responded: x.responded, ...stand(x), touches: touches.filter((t) => t.person_id === x.person_id).slice(0, 8) };
  });
}

/** Everything that happened, newest first, for the activity feed. */
export async function activityFeed(days = 14) {
  const db = await getDb();
  const since = new Date(Date.now() - days * DAY).toISOString();
  return dates((await db.execute(sql`
    select t.*, p.name as person, c.name as company
    from outreach_touches t left join people p on p.id = t.person_id left join companies c on c.id = coalesce(t.company_id, p.company_id)
    where t.at >= ${since}::timestamptz order by t.at desc limit 500`)).rows as Record<string, unknown>[], ["at"]) as unknown as (Touch & { person: string | null; company: string | null })[];
}

/** The last contact for each person, for the "already worked" marker on lists. */
export async function lastContacts() {
  const db = await getDb();
  const rows = dates((await db.execute(sql`select person_id, contacts, last_contact_at, last_channel, last_outcome, responded from person_outreach where contacts > 0`)).rows as Record<string, unknown>[], ["last_contact_at"]) as unknown as { person_id: number; contacts: number; last_contact_at: Date; last_channel: string; last_outcome: string; responded: boolean }[];
  return new Map(rows.map((r) => [r.person_id, r]));
}

/** What has been done today and this week, against the daily plan and LinkedIn's weekly limit. */
export async function pace() {
  const db = await getDb();
  const startOfDay = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const weekAgo = new Date(Date.now() - 7 * DAY).toISOString();
  const [r] = (await db.execute(sql`
    select
      count(*) filter (where channel = 'linkedin' and outcome in ('request_sent', 'feeler') and at >= ${startOfDay}::timestamptz)::int as connects_today,
      count(*) filter (where channel = 'linkedin' and outcome in ('request_sent', 'feeler') and at >= ${weekAgo}::timestamptz)::int as connects_week,
      count(*) filter (where channel = 'call' and logged_here and at >= ${startOfDay}::timestamptz)::int as calls_today,
      count(*) filter (where channel in ('email', 'text') and contacted and at >= ${startOfDay}::timestamptz)::int as messages_today
    from outreach_touches`)).rows as { connects_today: number; connects_week: number; calls_today: number; messages_today: number }[];
  return { ...r, plan: CADENCE };
}
