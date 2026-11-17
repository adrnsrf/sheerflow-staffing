import { KpiTable } from "@/components/kpi-table";
import { PageHeader, SampleNote, Stat } from "@/components/ui";
import { getKpis, getSetting, listUsers, type KpiTargets } from "@/core";
import { money } from "@/lib/format";

export default async function Vendor() {
  const vendor = (await listUsers()).find((u) => u.role === "vendor");
  const [weeks, targets] = await Promise.all([getKpis({ weeks: 3, userId: vendor?.id }), getSetting<KpiTargets>("kpi_targets")]);
  const meetings = weeks.reduce((n, w) => n + w.meetingsBooked, 0);
  const cost = (targets?.vendorWeeklyCost ?? 0) * weeks.length;
  const perMeeting = meetings ? cost / meetings : null;
  return (
    <>
      <PageHeader title="Vendor scorecard" sub={`${vendor?.name ?? "Vendor"}: activity, meetings booked and cost per meeting against the KPI targets.`} />
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Meetings booked (3 weeks)" value={meetings} />
        <Stat label="Cost (3 weeks)" value={money(cost)} hint={`${money(targets?.vendorWeeklyCost ?? 0)} a week (sample figure)`} />
        <Stat label="Cost per meeting" value={perMeeting ? money(perMeeting) : "No meetings"} hint={`Target ${money(targets?.costPerMeeting ?? 0)} or less`} tone={perMeeting && targets && perMeeting > targets.costPerMeeting ? "warn" : undefined} />
      </div>
      <KpiTable weeks={weeks} targets={targets as unknown as Record<string, number>} scale={0.5} />
      <SampleNote>Sample data. Weekly targets shown here are half the team targets, as a placeholder for the vendor&apos;s share.</SampleNote>
    </>
  );
}
