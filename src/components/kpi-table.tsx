import type { getKpis } from "@/core";

type Week = Awaited<ReturnType<typeof getKpis>>[number];
const ROWS: [keyof Week, string, string?][] = [
  ["dials", "Dials", "dials"], ["connects", "Connects (real decision-maker talks)", "connects"], ["gatekeeper", "Gatekeeper"], ["badNumbers", "Bad numbers"],
  ["meetingsBooked", "Meetings booked", "meetings"], ["meetingsHeld", "Meetings held"], ["agreements", "Agreements signed", "agreements"], ["placements", "Placements", "placements"],
];

/** Weekly funnel, newest week first, with a warning where a stage is under target. */
export function KpiTable({ weeks, targets, scale = 1 }: { weeks: Week[]; targets: Record<string, number> | null; scale?: number }) {
  return (
    <div className="card overflow-x-auto">
      <table className="tbl">
        <thead><tr><th>Stage</th>{weeks.map((w) => <th key={w.label} className="text-right">{w.label}</th>)}<th className="text-right">Weekly target</th></tr></thead>
        <tbody>
          {ROWS.map(([key, name, targetKey]) => {
            const target = targetKey && targets ? Math.round(targets[targetKey] * scale) : null;
            return (
              <tr key={key}>
                <td className="font-medium">{name}</td>
                {weeks.map((w, i) => {
                  const v = w[key] as number;
                  const low = target != null && v < target;
                  return <td key={w.label} className={`text-right tabular-nums ${i === 0 ? "font-semibold" : "muted"} ${low && i === 0 ? "text-rose-700" : ""}`}>{v}{low && i === 0 && " ▼"}</td>;
                })}
                <td className="muted text-right tabular-nums">{target ?? ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
