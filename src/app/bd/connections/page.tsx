import Link from "next/link";
import { connectionsUploadAction, saveNoteAction } from "@/app/actions";
import { LinkedInActions } from "@/components/linkedin";
import { Badge, Empty, PageHeader, Tier } from "@/components/ui";
import { listConnectCandidates, listConnectionQueue } from "@/core";

export default async function Connections({ searchParams }: { searchParams: Promise<{ checked?: string; error?: string }> }) {
  const q = await searchParams;
  const [queue, candidates] = await Promise.all([listConnectionQueue(), listConnectCandidates()]);
  const by = (st: string) => queue.filter((r) => r.person.connectionStatus === st);
  return (
    <>
      <PageHeader title="Connection queue" sub="Tick Connect?, Claude writes the note, you copy it and send the request yourself on LinkedIn. Nothing here touches your LinkedIn account." />
      {q.error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{q.error}</div>}
      {q.checked && <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">{q.checked}</div>}
      <h2 className="mb-2 text-sm font-semibold">Ready to send ({by("note_ready").length})</h2>
      {by("note_ready").length === 0 && <Empty>No notes ready. Tick someone below and run Claude.</Empty>}
      <div className="space-y-2">
        {by("note_ready").map(({ person: p, company }) => (
          <div key={p.id} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm"><span className="font-semibold">{p.name}</span><span className="muted">, {p.title} · </span>{company && <Link href={`/bd/accounts/${company.id}`} className="hover:underline">{company.name}</Link>}</div>
              <LinkedInActions person={p} />
            </div>
            <form action={saveNoteAction} className="mt-2 flex items-end gap-2">
              <input type="hidden" name="personId" value={p.id} />
              <textarea name="note" defaultValue={p.connectionNote ?? ""} maxLength={300} rows={2} className="field flex-1 text-sm" />
              <button className="btn">Save edit</button>
            </form>
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold">Waiting on Claude ({by("queued").length})</h2>
          <div className="card">
            {by("queued").length === 0 && <p className="muted p-4 text-sm">Nothing waiting.</p>}
            {by("queued").map(({ person: p, company }) => (
              <div key={p.id} className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5 text-sm last:border-b-0">
                <span>{p.name} <span className="muted">· {company?.name}</span></span><Badge tone="amber">Note queued</Badge>
              </div>
            ))}
          </div>
          <h2 className="mt-6 mb-2 text-sm font-semibold">Sent, waiting for accept ({by("sent").length})</h2>
          <div className="card">
            {by("sent").map(({ person: p, company }) => (
              <div key={p.id} className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5 text-sm last:border-b-0">
                <span>{p.name} <span className="muted">· {company?.name}</span></span>
                <LinkedInActions person={p} />
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold">Suggested to connect</h2>
          <div className="card">
            {candidates.map(({ person: p, company }) => (
              <div key={p.id} className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-2.5 text-sm last:border-b-0">
                <div className="min-w-0"><div className="truncate">{p.name} <span className="muted">· {p.title}</span></div><div className="muted text-xs">{company.name}</div></div>
                <div className="flex shrink-0 items-center gap-2"><Tier tier={company.icpTier} /><LinkedInActions person={p} compact /></div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="card mt-8 p-4 text-sm">
        <h2 className="font-semibold">Check who accepted</h2>
        <p className="muted mt-1 max-w-3xl">The app never signs in to LinkedIn. To check in bulk, ask LinkedIn for your own data (Settings, Data privacy, Get a copy of your data, Connections) and upload the Connections.csv it emails you. Everyone in it who is also in the app gets marked connected, with the date.</p>
        <form action={connectionsUploadAction} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="file" name="file" accept=".csv" required className="text-xs" />
          <button className="btn btn-primary">Check connections</button>
        </form>
      </section>
    </>
  );
}
