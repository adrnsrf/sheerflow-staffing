import Link from "next/link";
import { importApolloListAction } from "@/app/actions";
import { Act, Badge, PageHeader } from "@/components/ui";
import { ApolloError, apolloConfigured, apolloLists, type ApolloList } from "@/connectors/apollo";
import { getCredits } from "@/core";

type Params = { list?: string; page?: string; pages?: string; added?: string; skipped?: string; noDomain?: string; error?: string };

export default async function Apollo({ searchParams }: { searchParams: Promise<Params> }) {
  const q = await searchParams;
  const live = apolloConfigured();
  let lists: ApolloList[] = [], error = q.error ?? null;
  if (live && !error) {
    try { lists = await apolloLists(); } catch (e) { if (!(e instanceof ApolloError)) throw e; error = e.message; }
  }
  const credits = await getCredits();
  const next = q.list && Number(q.page) < Number(q.pages) ? Number(q.page) + 1 : null;
  return (
    <>
      <div className="muted mb-2 text-xs"><Link href="/system/connectors" className="hover:underline">Connections</Link> / Apollo</div>
      <PageHeader title="Apollo" sub="Free reads only from this screen: your saved lists and the accounts on them. Reveals and anything else that costs credits stay behind an approval in a Claude run.">
        <Badge tone={live ? "green" : "amber"}>{live ? "Live" : "Sample mode"}</Badge>
      </PageHeader>
      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      {q.added && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          <span>Page {q.page} of {q.pages}: added {q.added} new companies, skipped {q.skipped} already known{Number(q.noDomain) > 0 && `, ${q.noDomain} had no domain`}. 0 credits spent.</span>
          {next && <Act action={importApolloListAction} fields={{ listId: q.list!, page: next }} className="btn btn-primary">Import page {next}</Act>}
          <Link href="/bd/accounts" className="btn">See accounts</Link>
        </div>
      )}
      {!live ? (
        <div className="card p-5 text-sm leading-relaxed">
          <h2 className="mb-2 font-semibold">Connect Apollo</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>In Apollo, open Settings, Integrations, API keys and create a key.</li>
            <li>In this project folder, create a file named <code className="rounded bg-stone-100 px-1">.env.local</code> with one line: <code className="rounded bg-stone-100 px-1">APOLLO_API_KEY=your-key</code></li>
            <li>Stop the app and start it again.</li>
          </ol>
          <p className="muted mt-3">The key stays on your computer; <code>.env.local</code> is never committed. Until then, Claude can still read Apollo through its own connector and write results here.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Saved list</th><th>Type</th><th className="text-right">Records</th><th /></tr></thead>
            <tbody>
              {lists.map((l) => (
                <tr key={l.id}>
                  <td className="font-medium">{l.name}</td><td><Badge tone={l.modality === "accounts" ? "blue" : "gray"}>{l.modality === "accounts" ? "Companies" : "People"}</Badge></td>
                  <td className="text-right tabular-nums">{l.count.toLocaleString()}</td>
                  <td className="text-right">{l.modality === "accounts" && l.count > 0 && <Act action={importApolloListAction} fields={{ listId: l.id, page: 1 }} title="Brings in 25 companies at a time. Known domains are skipped.">Import first 25 companies</Act>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted mt-6 text-xs">Credit balance on record: {credits.balance.toLocaleString()} ({credits.ledger[0]?.reason ?? "no entries"}). See <Link href="/manage/budgets" className="underline">Budgets</Link>.</p>
    </>
  );
}
