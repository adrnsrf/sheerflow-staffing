import Link from "next/link";
import { PageHeader, SampleNote } from "@/components/ui";
import { fee, listDeals } from "@/core";
import type { DealStage } from "@/db/schema";
import { fmtDate, money } from "@/lib/format";

const STAGES: [DealStage, string, number][] = [["first_meeting", "First meeting", 0.15], ["terms", "Terms", 0.4], ["agreement_signed", "Signed agreement", 0.6], ["placement", "Placement", 1]];

export default async function Pipeline() {
  const deals = await listDeals();
  const weighted = deals.reduce((sum, { deal }) => sum + fee(deal.estSalary, deal.feePct) * (STAGES.find((x) => x[0] === deal.stage)?.[2] ?? 0), 0);
  return (
    <>
      <PageHeader title="Pipeline" sub={`From first meeting to placement. Fee forecast weighted by stage: ${money(weighted)}.`} />
      <div className="grid gap-4 lg:grid-cols-4">
        {STAGES.map(([stage, name, weight]) => {
          const col = deals.filter((d) => d.deal.stage === stage);
          return (
            <div key={stage}>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-sm font-semibold">{name}</h2>
                <span className="muted text-xs tabular-nums">{money(col.reduce((n, { deal }) => n + fee(deal.estSalary, deal.feePct), 0))} · {Math.round(weight * 100)}%</span>
              </div>
              <div className="space-y-2">
                {col.map(({ deal, company, owner }) => (
                  <div key={deal.id} className="card p-3 text-sm">
                    <Link href={`/bd/accounts/${company.id}`} className="font-semibold hover:underline">{company.name}</Link>
                    <div>{deal.roleTitle}</div>
                    <div className="muted mt-1 text-xs">{money(deal.estSalary)} at {deal.feePct}% = <span className="font-medium text-ink">{money(fee(deal.estSalary, deal.feePct))}</span></div>
                    <div className="muted text-xs">{owner?.name} · close {fmtDate(deal.expectedClose)}</div>
                  </div>
                ))}
                {col.length === 0 && <div className="muted rounded-xl border border-dashed border-stone-300 p-4 text-center text-xs">Empty</div>}
              </div>
            </div>
          );
        })}
      </div>
      <SampleNote />
    </>
  );
}
