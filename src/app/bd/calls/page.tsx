import Link from "next/link";
import { logCallAction } from "@/app/actions";
import { CopyButton } from "@/components/client";
import { Badge, PageHeader, Tier, type Tone } from "@/components/ui";
import { listCallList, listUsers } from "@/core";
import type { CallOutcome, CallQueueStatus } from "@/db/schema";
import { isDue, label, rel } from "@/lib/format";

const OUTCOMES: [CallOutcome, string, string][] = [
  ["connected", "Connected", "btn btn-primary"], ["meeting_booked", "Meeting booked", "btn btn-primary"], ["voicemail", "Voicemail", "btn"], ["gatekeeper", "Gatekeeper", "btn"],
  ["no_answer", "No answer", "btn"], ["dead_number", "Dead number", "btn btn-danger"], ["do_not_contact", "DNC", "btn btn-danger"],
];
const STATUS_TONE: Record<string, Tone> = { new: "teal", attempting: "amber", connected: "green", meeting_booked: "green", needs_info: "violet", dead: "gray", do_not_contact: "red" };
const FILTERS: CallQueueStatus[] = ["new", "attempting", "connected", "needs_info"];
const PAGE = 40;

export default async function Calls({ searchParams }: { searchParams: Promise<{ owner?: string; status?: string; all?: string }> }) {
  const sp = await searchParams;
  const owner = Number(sp.owner) || undefined;
  const status = FILTERS.find((f) => f === sp.status);
  const [rows, users] = await Promise.all([listCallList({ ownerId: owner }), listUsers()]);
  const open = rows.filter((r) => !["dead", "do_not_contact", "meeting_booked"].includes(r.entry.status));
  const closed = rows.filter((r) => !open.includes(r));
  const matching = status ? open.filter((r) => r.entry.status === status) : open;
  const active = sp.all ? matching : matching.slice(0, PAGE);
  const href = (p: Record<string, string | number | undefined>) => "/bd/calls?" + new URLSearchParams(Object.entries({ owner, status, ...p }).filter(([, x]) => x != null).map(([k, x]) => [k, String(x)])).toString();
  return (
    <>
      <PageHeader title="Call list" sub="Replaces the DFC call sheet. Each rep works a queue; outcomes are logged with one press and past calls are never overwritten.">
        <Link href={href({ owner: undefined })} className={`btn ${!owner ? "btn-primary" : ""}`}>Everyone</Link>
        {users.map((u) => <Link key={u.id} href={href({ owner: u.id })} className={`btn ${owner === u.id ? "btn-primary" : ""}`}>{u.name}</Link>)}
      </PageHeader>
      <div className="mb-4 flex flex-wrap items-center gap-1">
        <Link href={href({ status: undefined })} className={`rounded-md px-3 py-1.5 text-sm ${!status ? "bg-ink font-medium text-white" : "text-stone-600 hover:bg-stone-200"}`}>All open ({open.length})</Link>
        {FILTERS.map((f) => <Link key={f} href={href({ status: f })} className={`rounded-md px-3 py-1.5 text-sm ${status === f ? "bg-ink font-medium text-white" : "text-stone-600 hover:bg-stone-200"}`}>{label(f)} ({open.filter((r) => r.entry.status === f).length})</Link>)}
      </div>
      <div className="space-y-2">
        {active.map(({ entry, company, person, owner: who, dials, blocked }) => {
          const phone = person?.phone ?? company.hqPhone;
          const badLine = dials >= 4 && blocked / dials >= 0.3;
          return (
            <div key={entry.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/bd/accounts/${company.id}`} className="font-semibold hover:underline">{company.name}</Link>
                    <Tier tier={company.icpTier} score={company.icpScore} />
                    <Badge tone={STATUS_TONE[entry.status]}>{entry.sourceStatus ?? label(entry.status)}</Badge>
                    {entry.batch && <span className="muted text-xs">Batch {entry.batch}</span>}
                    {entry.nextStepDate && <Badge tone={isDue(entry.nextStepDate) ? "amber" : "gray"}>{entry.nextStep ?? "Next step"}: {rel(entry.nextStepDate)}</Badge>}
                  </div>
                  <div className="mt-1 text-sm">{person ? <>{person.name}<span className="muted">, {person.title}</span></> : <span className="muted">No contact yet</span>}</div>
                  {entry.topSignal && <div className="muted mt-0.5 text-xs">Why now: {entry.topSignal}</div>}
                  {entry.notes && <div className="mt-1 max-w-2xl whitespace-pre-line text-xs italic text-stone-600">{entry.notes}</div>}
                </div>
                <div className="text-right text-sm">
                  <div className="flex items-center justify-end gap-2">
                    <a href={`tel:${phone}`} className="font-semibold tabular-nums text-brand hover:underline">{phone}</a>
                    {phone && <CopyButton text={phone}>Copy</CopyButton>}
                  </div>
                  <div className="muted text-xs">{person?.phone ? `${person.phoneType?.replace("_", " ") ?? "Direct line"}${company.hqPhone ? ` · company ${company.hqPhone}` : ""}` : "Company line"}</div>
                  {company.altPhones && <details className="text-xs"><summary className="cursor-pointer text-brand">Other numbers</summary><div className="muted max-w-sm whitespace-pre-line text-left">{company.altPhones}</div></details>}
                  <div className={`mt-0.5 text-xs ${badLine ? "font-medium text-rose-700" : "muted"}`}>
                    {dials} dials, {blocked} gatekeeper or dead{badLine && ". Swap this number for a local office line."}
                  </div>
                  <div className="muted text-xs">{who?.name}{entry.lastContactAt && ` · last contact ${rel(entry.lastContactAt)}`}</div>
                </div>
              </div>
              <form action={logCallAction} className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-stone-100 pt-3">
                <input type="hidden" name="queueId" value={entry.id} />
                <input name="notes" placeholder="Note (optional)" className="field mr-1 w-56 py-1 text-xs" />
                {OUTCOMES.map(([value, text, cls]) => <button key={value} name="outcome" value={value} className={cls}>{text}</button>)}
              </form>
            </div>
          );
        })}
      </div>
      {matching.length > active.length && <div className="mt-4 text-center"><Link href={href({ all: 1 })} className="btn">Show all {matching.length}</Link></div>}
      {closed.length > 0 && (
        <>
          <h2 className="mt-8 mb-2 text-sm font-semibold">Off the queue</h2>
          <div className="card">
            <table className="tbl">
              <tbody>{closed.map(({ entry, company, person, owner: who }) => (
                <tr key={entry.id}><td><Link href={`/bd/accounts/${company.id}`} className="font-medium hover:underline">{company.name}</Link></td><td>{person?.name}</td><td><Badge tone={STATUS_TONE[entry.status]}>{entry.sourceStatus ?? label(entry.status)}</Badge></td><td className="muted">{entry.nextStep}</td><td className="muted">{who?.name}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
