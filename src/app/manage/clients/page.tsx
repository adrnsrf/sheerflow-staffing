import Link from "next/link";
import { Badge, PageHeader, SampleNote } from "@/components/ui";
import { listAgreements } from "@/core";
import { fmtDate, label } from "@/lib/format";

export default async function Clients() {
  const rows = await listAgreements();
  return (
    <>
      <PageHeader title="Clients & agreements" sub="Terms, fee percentage, guarantee and contract status. Status will come from PandaDoc or Docusign once connected." />
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Client</th><th>Agreement</th><th className="text-right">Fee</th><th className="text-right">Guarantee</th><th>Status</th><th>Signed</th><th>Via</th></tr></thead>
          <tbody>
            {rows.map(({ agreement: a, company }) => (
              <tr key={a.id}>
                <td><Link href={`/bd/accounts/${company.id}`} className="font-medium text-brand hover:underline">{company.name}</Link></td>
                <td>{a.kind}</td><td className="text-right tabular-nums">{a.feePct}%</td><td className="text-right tabular-nums">{a.guaranteeDays} days</td>
                <td><Badge tone={a.status === "signed" ? "green" : a.status === "sent" ? "amber" : "gray"}>{label(a.status)}</Badge></td>
                <td>{fmtDate(a.signedAt)}</td><td className="muted">{a.provider}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SampleNote />
    </>
  );
}
