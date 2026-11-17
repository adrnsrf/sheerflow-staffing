import { saveTargetsAction } from "@/app/actions";
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
      <details className="card mt-6 p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Change the weekly targets</summary>
        <form action={saveTargetsAction} className="mt-3 flex flex-wrap items-end gap-2 text-xs">
          {([["dials", "Dials"], ["connects", "Conversations"], ["meetings", "Meetings"], ["agreements", "Agreements"], ["placements", "Placements"], ["costPerMeeting", "Cost per meeting ($)"], ["vendorWeeklyCost", "Vendor cost per week ($)"]] as const).map(([k, name]) => (
            <label key={k} className="w-32">{name}<input name={k} type="number" min={0} defaultValue={targets?.[k] ?? 0} className="field mt-0.5 w-full text-sm" /></label>
          ))}
          <button className="btn btn-primary py-1.5 text-sm">Save targets</button>
        </form>
      </details>
      <section className="card mt-6 p-4 text-sm">
        <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Weekly review</h2><AskClaude kind="weekly_review" title="Write this week's sales review">Ask Claude to write this week&apos;s</AskClaude></div>
        {review ? <><p className="whitespace-pre-line leading-relaxed">{review.text}</p><p className="muted mt-2 text-xs">Written {new Date(review.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p></> : <p className="muted">No review yet. Claude writes one from these numbers when asked.</p>}
      </section>
      <SampleNote />
    </>
  );
}
