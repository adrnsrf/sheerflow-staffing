import Link from "next/link";
import { Badge, PageHeader } from "@/components/ui";
import { listCompanies } from "@/core";
import { allCompanyHeat } from "@/core/signals";
import { label } from "@/lib/format";

const PAGE = 50;

export default async function Accounts({ searchParams }: { searchParams: Promise<{ q?: string; n?: string }> }) {
  const { q, n } = await searchParams;
  const [companies, heat] = await Promise.all([listCompanies({ search: q }), allCompanyHeat()]);
  const byId = new Map(heat.map((h) => [h.company_id, h]));
  const rows = companies.map((c) => ({ c, h: byId.get(c.id) })).sort((a, b) => (b.h?.priority ?? 0) - (a.h?.priority ?? 0));
  const show = Math.max(PAGE, Number(n) || PAGE);
  return (
    <>
      <PageHeader title="Companies" sub="Every company the app knows, strongest case for reaching out first. Priority adds up recent signals and how well the company fits.">
        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Search by name or website" className="field w-64" />
          <button className="btn">Search</button>
        </form>
      </PageHeader>
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Company</th><th className="text-right">Priority</th><th>Why now</th><th className="text-right">Employees</th><th className="text-right">Data team</th><th className="text-right">Recruiters</th><th className="text-right">Open data roles</th><th>Status</th></tr></thead>
          <tbody>
            {rows.slice(0, show).map(({ c, h }) => (
              <tr key={c.id} className="hover:bg-stone-50">
                <td><Link href={`/bd/accounts/${c.id}`} className="font-medium text-brand hover:underline">{c.name}</Link><div className="muted text-xs">{c.domain ?? "No website on record"}</div></td>
                <td className="text-right"><span className={`font-semibold tabular-nums ${(h?.priority ?? 0) >= 45 ? "text-amber-700" : ""}`}>{Math.round(h?.priority ?? 0)}</span></td>
                <td className="muted max-w-xs text-xs">{h?.top_reasons?.slice(0, 2).join(" · ") || "No signals yet"}</td>
                <td className="text-right tabular-nums">{c.employees}</td><td className="text-right tabular-nums">{c.dataTeamSize}</td><td className="text-right tabular-nums">{c.recruitingTeamSize}</td><td className="text-right tabular-nums">{c.openDataRoles}</td>
                <td>{c.status !== "prospect" && <Badge tone={c.status === "client" ? "green" : "red"}>{label(c.status)}</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="muted mt-3 flex items-center gap-3 text-xs">
        <span>Showing {Math.min(show, rows.length)} of {rows.length}.</span>
        {rows.length > show && <Link href={`/bd/accounts?${new URLSearchParams({ ...(q ? { q } : {}), n: String(show + PAGE) })}`} className="btn">Show {Math.min(PAGE, rows.length - show)} more</Link>}
      </div>
    </>
  );
}
