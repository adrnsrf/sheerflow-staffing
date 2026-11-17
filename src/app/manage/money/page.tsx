import { addPlacementAction, invoiceStatusAction } from "@/app/actions";
import { Badge, PageHeader, Stat } from "@/components/ui";
import { fee, listPlacements } from "@/core";
import type { InvoiceStatus } from "@/db/schema";
import { fmtDate, label, money } from "@/lib/format";

const STATUSES: InvoiceStatus[] = ["not_invoiced", "invoiced", "paid", "overdue"];

export default async function Money({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [rows, q] = await Promise.all([listPlacements(), searchParams]);
  const total = (st: string) => rows.filter((r) => r.placement.invoiceStatus === st).reduce((n, { placement: p }) => n + fee(p.salary, p.feePct), 0);
  return (
    <>
      <PageHeader title="Money" sub="One row per placement: the fee, and whether it has been invoiced and paid. Kept by hand for now; later it can come from QuickBooks." />
      {q.error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{q.error}</div>}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Paid" value={money(total("paid"))} />
        <Stat label="Invoiced, waiting" value={money(total("invoiced"))} />
        <Stat label="Overdue" value={money(total("overdue"))} tone={total("overdue") ? "warn" : undefined} />
        <Stat label="Not invoiced yet" value={money(total("not_invoiced"))} />
      </div>
      <form action={addPlacementAction} className="card mb-6 flex flex-wrap items-end gap-2 p-4 text-xs">
        <label className="min-w-40 flex-1">Client<input name="company" required className="field mt-0.5 w-full text-sm" /></label>
        <label className="min-w-40 flex-1">Role filled<input name="role" required className="field mt-0.5 w-full text-sm" /></label>
        <label className="w-32">Salary ($)<input name="salary" type="number" min={1} required className="field mt-0.5 w-full text-sm" /></label>
        <label className="w-20">Fee %<input name="fee" type="number" min={1} max={50} defaultValue={20} className="field mt-0.5 w-full text-sm" /></label>
        <label>Start date<input name="start" type="date" className="field mt-0.5 block text-sm" /></label>
        <button className="btn btn-primary py-1.5 text-sm">Add placement</button>
      </form>
      {rows.length === 0 ? <div className="card muted p-8 text-center text-sm">No placements yet. Add one above when a candidate accepts an offer.</div> : (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Client</th><th>Role</th><th className="text-right">Salary</th><th className="text-right">Fee</th><th>Start</th><th>Due</th><th>Invoice</th><th /></tr></thead>
            <tbody>
              {rows.map(({ placement: p, company }) => (
                <tr key={p.id}>
                  <td className="font-medium">{company.name}</td><td>{p.roleTitle}</td>
                  <td className="text-right tabular-nums">{money(p.salary)}</td><td className="text-right font-medium tabular-nums">{money(fee(p.salary, p.feePct))} <span className="muted font-normal">({p.feePct}%)</span></td>
                  <td>{fmtDate(p.startDate)}</td><td>{fmtDate(p.dueDate)}</td>
                  <td><Badge tone={p.invoiceStatus === "paid" ? "green" : p.invoiceStatus === "overdue" ? "red" : p.invoiceStatus === "invoiced" ? "amber" : "gray"}>{label(p.invoiceStatus)}</Badge></td>
                  <td>
                    <form action={invoiceStatusAction} className="flex justify-end gap-1.5">
                      <input type="hidden" name="id" value={p.id} />
                      <select name="status" defaultValue={p.invoiceStatus} className="field py-0.5 text-xs">{STATUSES.map((st) => <option key={st} value={st}>{label(st)}</option>)}</select>
                      <button className="btn">Update</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
