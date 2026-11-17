import Link from "next/link";
import { connectionStatusAction, queueConnectionAction, saveNoteAction } from "@/app/actions";
import { CopyButton } from "@/components/client";
import { Act, Badge, Empty, PageHeader, SampleNote, Tier } from "@/components/ui";
import { listConnectCandidates, listConnectionQueue } from "@/core";

export default async function Connections() {
  const [queue, candidates] = await Promise.all([listConnectionQueue(), listConnectCandidates()]);
  const by = (st: string) => queue.filter((r) => r.person.connectionStatus === st);
  return (
    <>
      <PageHeader title="Connection queue" sub="Tick Connect?, Claude writes the note, you copy it and send the request yourself on LinkedIn. Nothing here touches your LinkedIn account." />
      <h2 className="mb-2 text-sm font-semibold">Ready to send ({by("note_ready").length})</h2>
      {by("note_ready").length === 0 && <Empty>No notes ready. Tick someone below and run Claude.</Empty>}
      <div className="space-y-2">
        {by("note_ready").map(({ person: p, company }) => (
          <div key={p.id} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm"><span className="font-semibold">{p.name}</span><span className="muted">, {p.title} · </span>{company && <Link href={`/bd/accounts/${company.id}`} className="hover:underline">{company.name}</Link>}</div>
              <div className="flex gap-1.5">
                <CopyButton text={p.connectionNote ?? ""} openUrl={p.linkedinUrl ?? undefined} className="btn btn-primary">Copy note and open profile</CopyButton>
                <Act action={connectionStatusAction} fields={{ personId: p.id, status: "sent" }}>I sent it</Act>
              </div>
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
                <Act action={connectionStatusAction} fields={{ personId: p.id, status: "connected" }}>Mark connected</Act>
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
                <div className="flex shrink-0 items-center gap-2"><Tier tier={company.icpTier} /><Act action={queueConnectionAction} fields={{ personId: p.id }}>Connect?</Act></div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <SampleNote />
    </>
  );
}
