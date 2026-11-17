import Link from "next/link";
import { Badge, PageHeader, Tier } from "@/components/ui";
import { listCompanies } from "@/core";
import { label } from "@/lib/format";

export default async function Accounts({ searchParams }: { searchParams: Promise<{ q?: string; tier?: string }> }) {
  const { q, tier } = await searchParams;
  const rows = await listCompanies({ search: q, tier });
  return (
    <>
      <PageHeader title="Accounts" sub="One record per company, deduped on domain.">
        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Search name or domain" className="field w-56" />
          <select name="tier" defaultValue={tier ?? ""} className="field"><option value="">All tiers</option><option>A</option><option>B</option><option>C</option></select>
          <button className="btn">Filter</button>
        </form>
      </PageHeader>
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Company</th><th>ICP</th><th>Industry</th><th>Location</th><th className="text-right">Employees</th><th className="text-right">Data team</th><th className="text-right">Recruiters</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-stone-50">
                <td><Link href={`/bd/accounts/${c.id}`} className="font-medium text-brand hover:underline">{c.name}</Link><div className="muted text-xs">{c.domain ?? "No website on record"}</div></td>
                <td><Tier tier={c.icpTier} score={c.icpScore} /></td>
                <td>{c.industry}</td><td>{c.location}</td>
                <td className="text-right tabular-nums">{c.employees}</td><td className="text-right tabular-nums">{c.dataTeamSize}</td><td className="text-right tabular-nums">{c.recruitingTeamSize}</td>
                <td><Badge tone={c.status === "client" ? "green" : c.status === "do_not_contact" ? "red" : "gray"}>{label(c.status)}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
