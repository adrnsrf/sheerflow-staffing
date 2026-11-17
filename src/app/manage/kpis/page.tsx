import { KpiTable } from "@/components/kpi-table";
import { PageHeader, SampleNote } from "@/components/ui";
import { getKpis, getSetting, type KpiTargets } from "@/core";

export default async function Kpis() {
  const [weeks, targets] = await Promise.all([getKpis({ weeks: 3 }), getSetting<KpiTargets>("kpi_targets")]);
  const w = weeks[0];
  const warnings = targets ? ([["dials", w.dials, targets.dials], ["connects", w.connects, targets.connects], ["meetings booked", w.meetingsBooked, targets.meetings]] as const).filter(([, v, t]) => v < t) : [];
  return (
    <>
      <PageHeader title="KPIs & weekly review" sub="Dials, connects, meetings, agreements and placements for the whole team, with a warning when a stage drops below target." />
      {warnings.length > 0 && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Below target in the last 7 days: {warnings.map(([name, v, t]) => `${name} (${v} of ${t})`).join(", ")}.
        </div>
      )}
      <KpiTable weeks={weeks} targets={targets as unknown as Record<string, number>} />
      <SampleNote />
    </>
  );
}
