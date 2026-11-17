import Link from "next/link";
import { addToCallListAction, queueJobAction } from "@/app/actions";
import { LinkedInActions } from "@/components/linkedin";
import { Act, Badge, Empty, PageHeader, type Tone } from "@/components/ui";
import { getNextActions, type ActionKind, type NextAction } from "@/core/decisions";

const KIND: Record<ActionKind, [string, Tone]> = {
  follow_up: ["Follow up", "green"], message: ["Message", "green"], send_request: ["Send request", "teal"], connect: ["Connect", "teal"],
  call: ["Call", "amber"], add_to_call_list: ["Call list", "amber"], research: ["Research", "violet"], find_contact: ["Find contact", "violet"],
};

function Buttons({ a }: { a: NextAction }) {
  const job = (kind: string, title: string) => <Act action={queueJobAction} fields={{ kind, title, payload: JSON.stringify({ companyId: a.company.id, personId: a.person?.id }) }} className="btn btn-primary" title="Queues a job for the next Claude run">{title.split(":")[0]}</Act>;
  switch (a.kind) {
    case "message": case "send_request": case "connect": return a.person ? <LinkedInActions person={a.person} compact /> : null;
    case "add_to_call_list": return <Act action={addToCallListAction} fields={{ companyId: a.company.id }} className="btn btn-primary">Add to call list</Act>;
    case "call": return <Link href={`/bd/accounts/${a.company.id}`} className="btn btn-primary">Open account to call</Link>;
    case "follow_up": return job("draft_follow_up", `Ask Claude to draft the follow-up: ${a.person?.name ?? a.company.name}`);
    case "research": return job("phone_research", `Ask Claude to research: ${a.company.name}`);
    case "find_contact": return job("find_decision_maker", `Ask Claude to find a contact: ${a.company.name}`);
  }
}

export default async function Actions({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const wanted = (await searchParams).kind;
  const kind = Object.keys(KIND).find((k) => k === wanted) as ActionKind | undefined;
  const all = await getNextActions({ limit: 400 });
  const shown = (kind ? all.filter((a) => a.kind === kind) : all).slice(0, 40);
  const count = (k: ActionKind) => all.filter((a) => a.kind === k).length;
  return (
    <>
      <PageHeader title="Next actions" sub="What to do next, who with, and why, ranked. Each suggestion comes from one rule and the signals behind it. Nothing happens until you press a button." />
      <div className="mb-4 flex flex-wrap items-center gap-1">
        <Link href="/bd/actions" className={`rounded-md px-3 py-1.5 text-sm ${!kind ? "bg-ink font-medium text-white" : "text-stone-600 hover:bg-stone-200"}`}>All ({all.length})</Link>
        {(Object.keys(KIND) as ActionKind[]).filter((k) => count(k) > 0).map((k) => (
          <Link key={k} href={`/bd/actions?kind=${k}`} className={`rounded-md px-3 py-1.5 text-sm ${kind === k ? "bg-ink font-medium text-white" : "text-stone-600 hover:bg-stone-200"}`}>{KIND[k][0]} ({count(k)})</Link>
        ))}
      </div>
      {shown.length === 0 ? <Empty>Nothing to act on yet. Import data or run a routine to bring in signals.</Empty> : (
        <div className="space-y-2">
          {shown.map((a) => (
            <div key={a.key} className="card flex flex-wrap items-start justify-between gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge tone={KIND[a.kind][1]}>{KIND[a.kind][0]}</Badge>
                  <Badge tone={a.when === "Today" ? "amber" : "gray"}>{a.when}</Badge>
                  <span className="muted text-xs tabular-nums" title="Higher means a stronger case for doing this now">Score {a.score}</span>
                </div>
                <div className="font-medium">{a.headline}</div>
                <div className="muted text-sm">{a.person && <>{a.person.title} · </>}<Link href={`/bd/accounts/${a.company.id}`} className="text-brand hover:underline">{a.company.name}</Link></div>
                <ul className="mt-1.5 space-y-0.5 text-sm">{a.why.map((w, i) => <li key={i} className="flex gap-2"><span className="text-brand">•</span><span>{w}</span></li>)}</ul>
              </div>
              <div className="shrink-0"><Buttons a={a} /></div>
            </div>
          ))}
        </div>
      )}
      {(kind ? count(kind) : all.length) > shown.length && <p className="muted mt-3 text-xs">Showing the top {shown.length}. The list refills as you work through it.</p>}
      <p className="muted mt-6 max-w-3xl text-xs leading-relaxed">How it decides: every signal has a weight that fades with age (see <Link href="/system/scoring" className="underline">Signal scoring</Link>). A person or company with enough fresh signals gets one suggested move, chosen by where things stand: accepted on LinkedIn means message, a hot poster you are not connected with means connect, a week without an answer means call.</p>
    </>
  );
}
