import Link from "next/link";
import { Badge, Empty, PageHeader, type Tone } from "@/components/ui";
import { activityFeed, channelLabel } from "@/core/history";

const TONE: Record<string, Tone> = { call: "amber", linkedin: "blue", email: "green", text: "green", meeting: "violet", screen_call: "violet", claude: "gray", note: "gray" };

export default async function Activity({ searchParams }: { searchParams: Promise<{ days?: string; channel?: string }> }) {
  const sp = await searchParams;
  const days = Number(sp.days) || 14;
  const all = await activityFeed(days);
  const rows = sp.channel ? all.filter((r) => r.channel === sp.channel) : all;
  const byDay = new Map<string, typeof rows>();
  for (const r of rows) { const k = r.at.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }); byDay.set(k, [...(byDay.get(k) ?? []), r]); }
  const channels = [...new Set(all.map((r) => r.channel))];
  const link = (p: Record<string, string | undefined>) => "/bd/activity?" + new URLSearchParams(Object.entries({ days: String(days), channel: sp.channel, ...p }).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <>
      <PageHeader title="Activity" sub="Everything that has been done, day by day: calls, LinkedIn requests, emails, texts, and what Claude prepared.">
        {[7, 14, 30].map((d) => <Link key={d} href={link({ days: String(d) })} className={`btn ${days === d ? "btn-primary" : ""}`}>{d} days</Link>)}
      </PageHeader>
      <div className="mb-4 flex flex-wrap gap-1">
        <Link href={link({ channel: undefined })} className={`rounded-md px-3 py-1.5 text-sm ${!sp.channel ? "bg-ink font-medium text-white" : "text-stone-600 hover:bg-stone-200"}`}>Everything ({all.length})</Link>
        {channels.map((c) => <Link key={c} href={link({ channel: c })} className={`rounded-md px-3 py-1.5 text-sm ${sp.channel === c ? "bg-ink font-medium text-white" : "text-stone-600 hover:bg-stone-200"}`}>{channelLabel(c)} ({all.filter((r) => r.channel === c).length})</Link>)}
      </div>
      {rows.length === 0 && <Empty>Nothing in this period.</Empty>}
      {[...byDay.entries()].map(([dayName, items]) => (
        <section key={dayName} className="mb-5">
          <h2 className="mb-1.5 text-sm font-semibold">{dayName} <span className="muted font-normal">· {items.length}</span></h2>
          <div className="card">
            {items.slice(0, 80).map((r) => (
              <div key={r.touch_id} className="flex items-start gap-3 border-b border-stone-100 px-4 py-2 text-sm last:border-b-0">
                <span className="w-24 shrink-0"><Badge tone={TONE[r.channel] ?? "gray"}>{channelLabel(r.channel)}</Badge></span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{r.person ?? r.company ?? "Unknown"}</span>{r.person && r.company && <span className="muted"> · {r.company_id ? <Link href={`/bd/accounts/${r.company_id}`} className="hover:underline">{r.company}</Link> : r.company}</span>}
                  <span className="muted"> · {r.channel === "claude" ? "prepared by Claude" : r.outcome.replace(/_/g, " ")}</span>
                  {r.notes && <span className="muted block truncate text-xs">{r.notes}</span>}
                </span>
                {r.responded && <Badge tone="green">Responded</Badge>}
              </div>
            ))}
            {items.length > 80 && <div className="muted px-4 py-2 text-xs">and {items.length - 80} more that day</div>}
          </div>
        </section>
      ))}
    </>
  );
}
