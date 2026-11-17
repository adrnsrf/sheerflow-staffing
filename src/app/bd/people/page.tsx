import Link from "next/link";
import { LastContact } from "@/components/history";
import { LinkedInActions } from "@/components/linkedin";
import { Empty, PageHeader } from "@/components/ui";
import { listPeople } from "@/core";
import { lastContacts } from "@/core/history";
import type { ConnectionStatus } from "@/db/schema";
import { label } from "@/lib/format";

const FILTERS: (ConnectionStatus | "")[] = ["", "none", "queued", "note_ready", "sent", "connected"];

export default async function People({ searchParams }: { searchParams: Promise<{ q?: string; connection?: string }> }) {
  const { q, connection } = await searchParams;
  const conn = FILTERS.find((f) => f && f === connection) as ConnectionStatus | undefined;
  const [rows, worked] = await Promise.all([listPeople({ search: q, connection: conn, limit: 150 }), lastContacts()]);
  return (
    <>
      <PageHeader title="People" sub="Decision makers from the call sheet and hiring posts, deduped on LinkedIn URL. Connect opens their profile in a new tab; you press Connect on LinkedIn yourself.">
        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Name, title or company" className="field w-56" />
          <select name="connection" defaultValue={conn ?? ""} className="field">{FILTERS.map((f) => <option key={f} value={f}>{f ? label(f) : "Any LinkedIn status"}</option>)}</select>
          <button className="btn">Filter</button>
        </form>
      </PageHeader>
      {rows.length === 0 ? <Empty>No people match.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Person</th><th>Company</th><th>Contact</th><th>LinkedIn</th></tr></thead>
            <tbody>
              {rows.map(({ person: p, company }) => (
                <tr key={p.id}>
                  <td><div className="flex flex-wrap items-center gap-2 font-medium">{p.name}<LastContact c={worked.get(p.id)} /></div><div className="muted max-w-72 text-xs">{p.title}{p.timeInRole && ` · ${p.timeInRole} in role`}</div></td>
                  <td>{company ? <Link href={`/bd/accounts/${company.id}`} className="text-brand hover:underline">{company.name}</Link> : <span className="muted">Unknown</span>}<div className="muted text-xs">{p.location}</div></td>
                  <td className="text-xs">{p.email}<div>{p.phone}{p.phoneType && <span className="muted"> ({p.phoneType.replace("_", " ")})</span>}</div></td>
                  <td><LinkedInActions person={p} compact /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length === 150 && <p className="muted mt-3 text-xs">Showing the first 150. Search to narrow.</p>}
    </>
  );
}
