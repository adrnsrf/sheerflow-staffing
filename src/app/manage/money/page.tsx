import { Badge, PageHeader, SampleNote, Stat } from "@/components/ui";
import { fee, listPlacements } from "@/core";
import { fmtDate, label, money } from "@/lib/format";

export default async function Money() {
  const rows = await listPlacements();
  const total = (st: string) => rows.filter((r) => r.placement.invoiceStatus === st).reduce((n, { placement: p }) => n + fee(p.salary, p.feePct), 0);
  return (
    <>
      <PageHeader title="Money" sub="Placements invoiced, paid and overdue. A simple cash view until QuickBooks is connected." />
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Paid" value={money(total("paid"))} />
        <Stat label="Invoiced, not yet due" value={money(total("invoiced"))} />
        <Stat label="Overdue" value={money(total("overdue"))} tone={total("overdue") ? "warn" : undefined} />
      </div>
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Client</th><th>Role</th><th>Candidate</th><th className="text-right">Salary</th><th className="text-right">Fee</th><th>Start</th><th>Due</th><th>Invoice</th></tr></thead>
          <tbody>
            {rows.map(({ placement: p, company, person }) => (
              <tr key={p.id}>
                <td className="font-medium">{company.name}</td><td>{p.roleTitle}</td><td className="muted">{person?.name ?? "Not linked"}</td>
                <td className="text-right tabular-nums">{money(p.salary)}</td><td className="text-right font-medium tabular-nums">{money(fee(p.salary, p.feePct))} <span className="muted font-normal">({p.feePct}%)</span></td>
                <td>{fmtDate(p.startDate)}</td><td>{fmtDate(p.dueDate)}</td>
                <td><Badge tone={p.invoiceStatus === "paid" ? "green" : p.invoiceStatus === "overdue" ? "red" : "amber"}>{label(p.invoiceStatus)}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SampleNote />
    </>
  );
}
