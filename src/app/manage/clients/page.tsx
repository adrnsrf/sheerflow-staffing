import Link from "next/link";
import { addAgreementAction, agreementStatusAction } from "@/app/actions";
import { Badge, PageHeader } from "@/components/ui";
import { listAgreements } from "@/core";
import { fmtDate, label } from "@/lib/format";

export default async function Clients({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [rows, q] = await Promise.all([listAgreements(), searchParams]);
  return (
    <>
      <PageHeader title="Clients" sub="Recruiting agreements and their terms. A company becomes a client when its agreement is marked signed. For now you keep this by hand; later the status can come from PandaDoc or Docusign." />
      {q.error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{q.error}</div>}
      <form action={addAgreementAction} className="card mb-6 flex flex-wrap items-end gap-2 p-4 text-xs">
        <label className="min-w-48 flex-1">Company<input name="company" required className="field mt-0.5 w-full text-sm" /></label>
        <label className="w-20">Fee %<input name="fee" type="number" min={1} max={50} defaultValue={20} className="field mt-0.5 w-full text-sm" /></label>
        <label className="w-36">Guarantee (days)<input name="guarantee" type="number" min={0} defaultValue={90} className="field mt-0.5 w-full text-sm" /></label>
        <label>Status<select name="status" className="field mt-0.5 block text-sm"><option value="draft">Draft</option><option value="sent">Sent</option><option value="signed">Signed</option></select></label>
        <button className="btn btn-primary py-1.5 text-sm">Add agreement</button>
      </form>
      {rows.length === 0 ? <div className="card muted p-8 text-center text-sm">No agreements yet. Add one above when you send terms to a company.</div> : (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Client</th><th>Agreement</th><th className="text-right">Fee</th><th className="text-right">Guarantee</th><th>Status</th><th>Signed</th><th /></tr></thead>
            <tbody>
              {rows.map(({ agreement: a, company }) => (
                <tr key={a.id}>
                  <td><Link href={`/bd/accounts/${company.id}`} className="font-medium text-brand hover:underline">{company.name}</Link></td>
                  <td>{a.kind}</td><td className="text-right tabular-nums">{a.feePct}%</td><td className="text-right tabular-nums">{a.guaranteeDays} days</td>
                  <td><Badge tone={a.status === "signed" ? "green" : a.status === "sent" ? "amber" : "gray"}>{label(a.status)}</Badge></td>
                  <td>{fmtDate(a.signedAt)}</td>
                  <td>
                    <form action={agreementStatusAction} className="flex justify-end gap-1.5">
                      <input type="hidden" name="id" value={a.id} />
                      <select name="status" defaultValue={a.status} className="field py-0.5 text-xs"><option value="draft">Draft</option><option value="sent">Sent</option><option value="signed">Signed</option></select>
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
