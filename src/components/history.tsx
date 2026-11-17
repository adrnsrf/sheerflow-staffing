import { channelLabel, type Touch } from "@/core/history";
import { rel } from "@/lib/format";

const DOT: Record<string, string> = { call: "bg-amber-500", linkedin: "bg-sky-500", email: "bg-emerald-500", text: "bg-emerald-400", meeting: "bg-violet-500", screen_call: "bg-violet-400", claude: "bg-stone-300", note: "bg-stone-300" };
const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const words = (t: Touch) => (t.channel === "claude" ? "Claude prepared something" : `${channelLabel(t.channel)}${t.outcome ? `: ${t.outcome.replace(/_/g, " ")}` : ""}`);

/** A person's touches as a row of dots, oldest to newest, each naming what happened on hover. */
export function TouchDots({ touches }: { touches: Touch[] }) {
  return (
    <span className="inline-flex items-center gap-1">
      {[...touches].reverse().map((t) => <span key={t.touch_id} title={`${day(t.at)} · ${words(t)}${t.notes ? ` · ${t.notes.slice(0, 120)}` : ""}`} className={`h-2.5 w-2.5 rounded-full ${DOT[t.channel] ?? "bg-stone-300"} ${t.responded ? "ring-2 ring-emerald-600 ring-offset-1" : ""}`} />)}
    </span>
  );
}

/** "Emailed 3 days ago", for marking people who have already been worked. */
export function LastContact({ c }: { c?: { contacts: number; last_contact_at: Date; last_channel: string; responded: boolean } }) {
  if (!c) return null;
  const when = rel(c.last_contact_at);
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${c.responded ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600"}`} title={`${c.contacts} contact${c.contacts === 1 ? "" : "s"} so far`}>
      {c.responded ? "Responded · " : ""}{channelLabel(c.last_channel)} {when}{c.contacts > 1 ? ` · ${c.contacts}x` : ""}
    </span>
  );
}
