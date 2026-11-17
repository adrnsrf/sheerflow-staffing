import { AskClaude } from "@/components/ask-claude";
import { KpiTable } from "@/components/kpi-table";
import { PageHeader, SampleNote } from "@/components/ui";
import { getKpis, getSetting, type KpiTargets } from "@/core";

export default async function Kpis() {
  const [weeks, targets, review] = await Promise.all([getKpis({ weeks: 3 }), getSetting<KpiTargets>("kpi_targets"), getSetting<{ text: string; savedAt: string }>("weekly_review")]);
  const w = weeks[0];
  const warnings = targets ? ([["dials", w.dials, targets.dials], ["connects", w.connects, targets.connects], ["meetings booked", w.meetingsBooked, targets.meetings]] as const).filter(([, v, t]) => v < t) : [];
  return (
    <>
      <PageHeader title="Numbers" sub="Dials, conversations, meetings, agreements and placements for the whole team, week by week, against your targets." />
      {warnings.length > 0 && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Below target in the last 7 days: {warnings.map(([name, v, t]) => `${name} (${v} of ${t})`).join(", ")}.
        </div>
      )}
      <KpiTable weeks={weeks} targets={targets as unknown as Record<string, number>} />
      <section className="card mt-6 p-4 text-sm">
        <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Weekly review</h2><AskClaude kind="weekly_review" title="Write this week's sales review">Ask Claude to write this week&apos;s</AskClaude></div>
        {review ? <><p className="whitespace-pre-line leading-relaxed">{review.text}</p><p className="muted mt-2 text-xs">Written {new Date(review.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p></> : <p className="muted">No review yet. Claude writes one from these numbers when asked.</p>}
      </section>
      <SampleNote />
    </>
  );
}
