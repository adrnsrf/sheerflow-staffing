import Link from "next/link";
import { signalAction } from "@/app/actions";
import { Act, Badge, Empty, PageHeader, type Tone } from "@/components/ui";
import { listSignals } from "@/core";
import { allCompanyHeat } from "@/core/signals";
import type { SignalStatus } from "@/db/schema";
import { label, rel } from "@/lib/format";

const TABS: SignalStatus[] = ["new", "kept", "promoted", "dismissed"];
const TYPE_TONE: Record<string, Tone> = { hiring_post: "teal", new_leader: "violet", job_posting: "blue", job_alert: "blue", funding: "amber", staffing_intent: "amber" };

const PAGE = 20;

export default async function Signals({ searchParams }: { searchParams: Promise<{ status?: string; n?: string }> }) {
  const sp = await searchParams;
  const status = TABS.find((t) => t === sp.status) ?? "new";
  const [found, heat] = await Promise.all([listSignals({ status, limit: 2000 }), allCompanyHeat()]);
  // Best company first; among equals, newest first.
  const pri = new Map(heat.map((h) => [h.company_id, h.priority]));
  const newest = Math.max(0, ...found.map((r) => r.signal.signalDate.getTime()));
  const of = (r: (typeof found)[number]) => (r.company ? pri.get(r.company.id) ?? 0 : 0) - ((newest - r.signal.signalDate.getTime()) / 86_400_000) * 2;
  const all = [...found].sort((a, b) => of(b) - of(a));
  const show = Math.max(PAGE, Number(sp.n) || PAGE), rows = all.slice(0, show);
  return (
    <>
      <PageHeader title="Signals inbox" sub="New reasons to contact a company, best fit and freshest first. Promote puts the company on the call list; Dismiss hides it." />
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
                  {company && (pri.get(company.id) ?? 0) > 0 && <Badge tone={(pri.get(company.id) ?? 0) >= 45 ? "amber" : "gray"}>Priority {Math.round(pri.get(company.id) ?? 0)}</Badge>}
                  {signal.careerVerified === "Yes" && <Badge tone="green">Role is on their careers page</Badge>}
                  <span className="muted text-xs">{rel(signal.signalDate)} · {signal.source}</span>
                </div>
                <div className="font-medium">{signal.title}</div>
                {signal.summary && <p className="muted mt-0.5 text-sm">{signal.summary}</p>}
                <div className="mt-1.5 flex flex-wrap gap-x-4 text-xs">
                  {company && <Link href={`/bd/accounts/${company.id}`} className="font-medium text-brand hover:underline">{company.name}</Link>}
                  {person && <span className="muted">{person.name}, {person.title}</span>}
                  {signal.sourceUrl && <a href={signal.sourceUrl} target="_blank" rel="noreferrer" className="muted hover:underline">View the post</a>}
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
      <div className="muted mt-3 flex items-center gap-3 text-xs">
        <span>Showing {rows.length} of {all.length}.</span>
        {all.length > show && <Link href={`/bd/signals?status=${status}&n=${show + PAGE}`} className="btn">Show {Math.min(PAGE, all.length - show)} more</Link>}
      </div>
    </>
  );
}
