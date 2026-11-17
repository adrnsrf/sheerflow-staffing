import Link from "next/link";
import { addToCallListAction } from "@/app/actions";
import { AskClaude, queuedJobKeys } from "@/components/ask-claude";
import { LinkedInActions } from "@/components/linkedin";
import { Act, Badge, Empty, PageHeader, type Tone } from "@/components/ui";
import { jobKey } from "@/core";
import { getNextActions, type ActionKind, type NextAction } from "@/core/decisions";

const KIND: Record<ActionKind, [string, Tone]> = {
  follow_up: ["Follow up", "green"], message: ["Message", "green"], send_request: ["Send request", "teal"], connect: ["Connect", "teal"],
  call: ["Call", "amber"], add_to_call_list: ["Call list", "amber"], research: ["Research", "violet"], find_contact: ["Find contact", "violet"],
};

// The job each "ask Claude" action queues. Used both for the button and to tell which actions are already waiting.
const JOB: Partial<Record<ActionKind, [string, string]>> = { follow_up: ["draft_follow_up", "Ask Claude to draft the follow-up"], research: ["phone_research", "Ask Claude to research"], find_contact: ["find_decision_maker", "Ask Claude to find a contact"] };
const jobFor = (a: NextAction) => ({ kind: JOB[a.kind]![0], payload: { companyId: a.company.id, personId: a.person?.id ?? null }, title: `${JOB[a.kind]![1]}: ${a.person?.name ?? a.company.name}` });

function Buttons({ a }: { a: NextAction }) {
  switch (a.kind) {
    case "message": case "send_request": case "connect": return a.person ? <LinkedInActions person={a.person} compact /> : null;
    case "add_to_call_list": return <Act action={addToCallListAction} fields={{ companyId: a.company.id }} className="btn btn-primary">Add to call list</Act>;
    case "call": return <Link href={`/bd/accounts/${a.company.id}`} className="btn btn-primary">Open account to call</Link>;
    default: { if (a.draftReady) return <Link href="/bd/drafts" className="btn btn-primary">Open the draft</Link>;
      const j = jobFor(a); return <AskClaude kind={j.kind} title={j.title} payload={j.payload} className="btn btn-primary">{JOB[a.kind]![1]}</AskClaude>; }
  }
}

export default async function Actions({ searchParams }: { searchParams: Promise<{ kind?: string; n?: string }> }) {
  const sp = await searchParams;
  const wanted = sp.kind;
  const kind = Object.keys(KIND).find((k) => k === wanted) as ActionKind | undefined;
  const [everything, queued] = await Promise.all([getNextActions({ limit: 400 }), queuedJobKeys()]);
  // Anything already handed to Claude leaves the to-do list and waits in its own group.
  const isWaiting = (x: NextAction) => !!JOB[x.kind] && queued.has(jobKey(jobFor(x).kind, jobFor(x).payload));
  const all = everything.filter((x) => !isWaiting(x)), waiting = everything.filter(isWaiting);
  const size = Math.max(15, Number(sp.n) || 15);
  const pool = kind ? all.filter((a) => a.kind === kind) : all;
  const shown = pool.slice(0, size);
  const count = (k: ActionKind) => all.filter((a) => a.kind === k).length;
  return (
    <>
      <PageHeader title="To do: business development" sub="The strongest moves first: who to follow up with, connect with or research, and why. Work from the top; you do not need to clear the list." />
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
      {waiting.length > 0 && (
        <div className="card mt-4 p-4 text-sm">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Waiting on Claude ({waiting.length})</h2><Link href="/system/claude" className="btn">Open Claude to run them</Link></div>
          <ul className="muted mt-2 space-y-0.5">{waiting.map((w) => <li key={w.key}>{w.headline} · {w.company.name}</li>)}</ul>
        </div>
      )}
      {pool.length > shown.length && (
        <div className="muted mt-3 flex items-center gap-3 text-xs">
          <span>These are the top {shown.length} of {pool.length}. Finish them and the next ones move up.</span>
          <Link href={`/bd/actions?${new URLSearchParams({ ...(kind ? { kind } : {}), n: String(size + 15) })}`} className="btn">Show 15 more</Link>
        </div>
      )}
      <p className="muted mt-6 max-w-3xl text-xs leading-relaxed">How it decides: every signal has a weight that fades with age (see <Link href="/system/scoring" className="underline">Signal scoring</Link>). A person or company with enough fresh signals gets one suggested move, chosen by where things stand: accepted on LinkedIn means message, a hot poster you are not connected with means connect, a week without an answer means call.</p>
    </>
  );
}
