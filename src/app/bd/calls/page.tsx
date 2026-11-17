import Link from "next/link";
import { logCallAction } from "@/app/actions";
import { CopyButton } from "@/components/client";
import { Badge, PageHeader, Tier, type Tone } from "@/components/ui";
import { listCallList, listUsers, usable } from "@/core";
import type { CallOutcome, CallQueueStatus } from "@/db/schema";
import { isDue, label, rel } from "@/lib/format";

// What happened on this dial. The row's status follows from it.
const OUTCOMES: [CallOutcome, string, string][] = [
  ["connected", "Connected", "btn btn-primary"], ["meeting_booked", "Meeting booked", "btn btn-primary"], ["email_requested", "Email requested", "btn"], ["voicemail", "Voicemail", "btn"],
  ["no_answer", "No answer", "btn"], ["gatekeeper", "Gatekeeper", "btn"], ["bad_number", "Bad number", "btn btn-danger"], ["wrong_person", "Wrong person", "btn btn-danger"],
  ["not_interested", "Not interested", "btn btn-danger"], ["do_not_contact", "Do not contact", "btn btn-danger"],
];
const STATUS: Record<CallQueueStatus, [string, Tone]> = {
  new: ["Not started", "teal"], attempting: ["Attempting", "amber"], connected: ["Connected", "green"], meeting_booked: ["Meeting booked", "green"],
  needs_info: ["Needs info", "violet"], closed: ["Closed", "gray"], do_not_contact: ["Do not contact", "red"],
};
const FILTERS: CallQueueStatus[] = ["new", "attempting", "connected", "needs_info"];
const SOURCE: Record<string, string> = { apollo: "Apollo", claude_research: "Claude research", call_sheet: "Call sheet", manual: "Typed in" };
const PAGE = 40;

export default async function Calls({ searchParams }: { searchParams: Promise<{ owner?: string; status?: string; all?: string }> }) {
  const sp = await searchParams;
  const owner = Number(sp.owner) || undefined;
  const status = FILTERS.find((f) => f === sp.status);
  const [rows, users] = await Promise.all([listCallList({ ownerId: owner }), listUsers()]);
  const open = rows.filter((r) => !["closed", "do_not_contact", "meeting_booked"].includes(r.entry.status));
  const closed = rows.filter((r) => !open.includes(r));
  const matching = status ? open.filter((r) => r.entry.status === status) : open;
  const active = sp.all ? matching : matching.slice(0, PAGE);
  const href = (p: Record<string, string | number | undefined>) => "/bd/calls?" + new URLSearchParams(Object.entries({ owner, status, ...p }).filter(([, x]) => x != null).map(([k, x]) => [k, String(x)])).toString();
  return (
    <>
      <PageHeader title="Call list" sub="Pick the number you dialed and press what happened. The call is logged against that number and the row's status follows.">
        <Link href={href({ owner: undefined })} className={`btn ${!owner ? "btn-primary" : ""}`}>Everyone</Link>
        {users.map((u) => <Link key={u.id} href={href({ owner: u.id })} className={`btn ${owner === u.id ? "btn-primary" : ""}`}>{u.name}</Link>)}
      </PageHeader>
      <div className="mb-4 flex flex-wrap items-center gap-1">
        <Link href={href({ status: undefined })} className={`rounded-md px-3 py-1.5 text-sm ${!status ? "bg-ink font-medium text-white" : "text-stone-600 hover:bg-stone-200"}`}>All open ({open.length})</Link>
        {FILTERS.map((f) => <Link key={f} href={href({ status: f })} className={`rounded-md px-3 py-1.5 text-sm ${status === f ? "bg-ink font-medium text-white" : "text-stone-600 hover:bg-stone-200"}`}>{STATUS[f][0]} ({open.filter((r) => r.entry.status === f).length})</Link>)}
      </div>
      <div className="space-y-2">
        {active.map(({ entry, company, person, owner: who, phones }) => {
          const first = phones.find(usable) ?? phones[0];
          return (
            <form key={entry.id} action={logCallAction} className="card p-4">
              <input type="hidden" name="queueId" value={entry.id} />
              <div className="grid gap-4 lg:grid-cols-5">
                <div className="min-w-0 lg:col-span-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/bd/accounts/${company.id}`} className="font-semibold hover:underline">{company.name}</Link>
                    <Tier tier={company.icpTier} score={company.icpScore} />
                    <Badge tone={STATUS[entry.status][1]}>{STATUS[entry.status][0]}</Badge>
                    {entry.nextStepDate && <Badge tone={isDue(entry.nextStepDate) ? "amber" : "gray"}>{entry.nextStep ?? "Next step"}: {rel(entry.nextStepDate)}</Badge>}
                  </div>
                  <div className="mt-1 text-sm">{person ? <>{person.name}<span className="muted">, {person.title}</span></> : <span className="muted">No contact yet</span>}</div>
                  {entry.topSignal && <div className="muted mt-0.5 text-xs">Why now: {entry.topSignal}</div>}
                  <div className="muted mt-0.5 text-xs">{who?.name}{entry.lastContactAt && ` · last contact ${rel(entry.lastContactAt)}`}{entry.batch && ` · batch ${entry.batch}`}{entry.sourceStatus && ` · sheet status: ${entry.sourceStatus}`}</div>
                  {entry.notes && <details className="mt-1 text-xs"><summary className="cursor-pointer text-brand">Notes from the call sheet</summary><div className="mt-1 whitespace-pre-line italic text-stone-600">{entry.notes}</div></details>}
                </div>
                <div className="lg:col-span-2">
                  {phones.length === 0 && <div className="muted text-sm">No phone number on file.</div>}
                  {phones.map((p) => {
                    const dead = !usable(p);
                    const walled = !dead && p.dials >= 3 && p.gatekeeper / p.dials >= 0.5 && p.reached === 0;
                    return (
                      <label key={p.id} className={`flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-stone-50 ${dead ? "opacity-60" : ""}`}>
                        <input type="radio" name="phoneNumberId" value={p.id} defaultChecked={p.id === first?.id} className="mt-1 accent-teal-700" />
                        <span className="min-w-0 flex-1">
                          <span className={`font-semibold tabular-nums ${dead ? "line-through" : "text-brand"}`}>{p.number}</span>{" "}
                          {p.status === "bad" && <Badge tone="red">Bad number</Badge>}{p.status === "do_not_call" && <Badge tone="red">Do not call</Badge>}{p.status === "good" && <Badge tone="green">Works</Badge>}{walled && <Badge tone="amber">Gatekeeper every time</Badge>}
                          <span className="muted block text-xs">{p.personId ? `${person?.name?.split(" ")[0] ?? "Contact"}'s ${p.kind === "mobile" ? "mobile" : "direct line"}` : p.label ?? label(p.kind)} · {SOURCE[p.source]}{p.dials > 0 && ` · ${p.dials} dial${p.dials > 1 ? "s" : ""}`}</span>
                        </span>
                        {!dead && <CopyButton text={p.number}>Copy</CopyButton>}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-stone-100 pt-3">
                <input name="notes" placeholder="Note (optional)" className="field mr-1 w-56 py-1 text-xs" />
                {OUTCOMES.map(([value, text, cls]) => <button key={value} name="outcome" value={value} className={cls}>{text}</button>)}
              </div>
            </form>
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
                <tr key={entry.id}><td><Link href={`/bd/accounts/${company.id}`} className="font-medium hover:underline">{company.name}</Link></td><td>{person?.name}</td><td><Badge tone={STATUS[entry.status][1]}>{STATUS[entry.status][0]}</Badge></td><td className="muted">{entry.nextStep}</td><td className="muted">{who?.name}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
