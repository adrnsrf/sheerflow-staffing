import Link from "next/link";
import { addDealAction, dealStageAction } from "@/app/actions";
import { PageHeader } from "@/components/ui";
import { fee, listDeals } from "@/core";
import type { DealStage } from "@/db/schema";
import { money } from "@/lib/format";

const STAGES: [DealStage, string, number][] = [["first_meeting", "First meeting", 0.15], ["terms", "Terms", 0.4], ["agreement_signed", "Signed agreement", 0.6], ["placement", "Placement", 1]];

export default async function Pipeline({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [deals, q] = await Promise.all([listDeals(), searchParams]);
  const weighted = deals.reduce((sum, { deal }) => sum + fee(deal.estSalary, deal.feePct) * (STAGES.find((x) => x[0] === deal.stage)?.[2] ?? 0), 0);
  return (
    <>
      <PageHeader title="Deals" sub={`Client deals from first meeting to placement. Add one when a company agrees to talk about a role. Expected fees, weighted by how far along each deal is: ${money(weighted)}.`} />
      {q.error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{q.error}</div>}
      <form action={addDealAction} className="card mb-6 flex flex-wrap items-end gap-2 p-4 text-xs">
        <label className="min-w-40 flex-1">Company<input name="company" required className="field mt-0.5 w-full text-sm" /></label>
        <label className="min-w-40 flex-1">Role they want filled<input name="role" required placeholder="e.g. Senior Data Engineer" className="field mt-0.5 w-full text-sm" /></label>
        <label className="w-32">Salary ($)<input name="salary" type="number" min={1} required placeholder="150000" className="field mt-0.5 w-full text-sm" /></label>
        <label className="w-20">Fee %<input name="fee" type="number" min={1} max={50} defaultValue={20} required className="field mt-0.5 w-full text-sm" /></label>
        <label>Stage<select name="stage" className="field mt-0.5 block text-sm">{STAGES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
        <button className="btn btn-primary py-1.5 text-sm">Add deal</button>
      </form>
      <div className="grid gap-4 lg:grid-cols-4">
        {STAGES.map(([stage, name, weight]) => {
          const col = deals.filter((d) => d.deal.stage === stage);
          return (
            <div key={stage}>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-sm font-semibold">{name}</h2>
                <span className="muted text-xs tabular-nums">{money(col.reduce((n, { deal }) => n + fee(deal.estSalary, deal.feePct), 0))} · counts {Math.round(weight * 100)}%</span>
              </div>
              <div className="space-y-2">
                {col.map(({ deal, company }) => (
                  <div key={deal.id} className="card p-3 text-sm">
                    <Link href={`/bd/accounts/${company.id}`} className="font-semibold hover:underline">{company.name}</Link>
                    <div>{deal.roleTitle}</div>
                    <div className="muted mt-1 text-xs">{money(deal.estSalary)} at {deal.feePct}% = <span className="font-medium text-ink">{money(fee(deal.estSalary, deal.feePct))}</span></div>
                    <form action={dealStageAction} className="mt-2 flex gap-1.5">
                      <input type="hidden" name="id" value={deal.id} />
                      <select name="stage" defaultValue={deal.stage} className="field min-w-0 flex-1 py-0.5 text-xs">{STAGES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>
                      <button className="btn">Move</button>
                    </form>
                  </div>
                ))}
                {col.length === 0 && <div className="muted rounded-xl border border-dashed border-stone-300 p-4 text-center text-xs">None yet</div>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
