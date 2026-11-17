import Link from "next/link";
import { signalAction } from "@/app/actions";
import { Act, Badge, Empty, PageHeader, SampleNote, Tier, type Tone } from "@/components/ui";
import { listSignals } from "@/core";
import type { SignalStatus } from "@/db/schema";
import { label, rel } from "@/lib/format";

const TABS: SignalStatus[] = ["new", "kept", "promoted", "dismissed"];
const TYPE_TONE: Record<string, Tone> = { hiring_post: "teal", new_leader: "violet", job_posting: "blue", job_alert: "blue", funding: "amber", staffing_intent: "amber" };

export default async function Signals({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const wanted = (await searchParams).status;
  const status = TABS.find((t) => t === wanted) ?? "new";
  const rows = await listSignals({ status });
  return (
    <>
      <PageHeader title="Signals inbox" sub="Every reason to act now, ranked by ICP fit and freshness. Keep, dismiss, or promote to the call list." />
      <div className="mb-4 flex gap-1">
        {TABS.map((t) => (
          <Link key={t} href={`/bd/signals?status=${t}`} className={`rounded-md px-3 py-1.5 text-sm ${t === status ? "bg-ink font-medium text-white" : "text-stone-600 hover:bg-stone-200"}`}>{label(t)}</Link>
        ))}
      </div>
      {rows.length === 0 ? <Empty>Nothing here.</Empty> : (
        <div className="space-y-2">
          {rows.map(({ signal, company, person }) => (
            <div key={signal.id} className="card flex items-start gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge tone={TYPE_TONE[signal.type]}>{signal.category ?? label(signal.type)}</Badge>
                  {company && <Tier tier={company.icpTier} score={company.icpScore} />}
                  {signal.careerVerified && <Badge tone={signal.careerVerified === "Yes" ? "green" : "gray"}>Careers page: {signal.careerVerified}</Badge>}
                  <span className="muted text-xs">{rel(signal.signalDate)} · {signal.source}</span>
                </div>
                <div className="font-medium">{signal.title}</div>
                {signal.summary && <p className="muted mt-0.5 text-sm">{signal.summary}</p>}
                <div className="mt-1.5 flex flex-wrap gap-x-4 text-xs">
                  {company && <Link href={`/bd/accounts/${company.id}`} className="font-medium text-brand hover:underline">{company.name}</Link>}
                  {person && <span className="muted">{person.name}, {person.title}</span>}
                  {signal.sourceUrl && <a href={signal.sourceUrl} target="_blank" rel="noreferrer" className="muted hover:underline">Open source</a>}
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {status !== "promoted" && <Act action={signalAction} fields={{ id: signal.id, status: "promoted" }} className="btn btn-primary" title="Adds the company to the call list">Promote</Act>}
                {status === "new" && <Act action={signalAction} fields={{ id: signal.id, status: "kept" }}>Keep</Act>}
                {status !== "dismissed" && status !== "promoted" && <Act action={signalAction} fields={{ id: signal.id, status: "dismissed" }} className="btn btn-danger">Dismiss</Act>}
                {status === "dismissed" && <Act action={signalAction} fields={{ id: signal.id, status: "new" }}>Restore</Act>}
              </div>
            </div>
          ))}
        </div>
      )}
      <SampleNote />
    </>
  );
}
