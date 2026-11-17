import Link from "next/link";
import { compileCandidateAction, refreshScreenCallAction } from "@/app/actions";
import { CandidateOutreach } from "@/components/outreach";
import { Act, Badge, Empty, PageHeader, type Tone } from "@/components/ui";
import { retellConfigured } from "@/connectors/retell";
import { getCandidateActions, type CandidateAction, type CandidateActionKind } from "@/core/candidate-actions";

const KIND: Record<CandidateActionKind, [string, Tone]> = {
  submit: ["Submit", "green"], screen: ["Screen", "green"], check_call: ["Check call", "blue"], reach_out: ["Reach out", "teal"], nudge: ["Follow up", "amber"], compile: ["Compile", "violet"],
};

function Buttons({ a, live }: { a: CandidateAction; live: boolean }) {
  if (a.kind === "compile") return <Act action={compileCandidateAction} fields={{ personId: a.person.id }} className="btn btn-primary" title="Queues a job for the next Claude run">Ask Claude to compile</Act>;
  if (a.kind === "check_call") return <Act action={refreshScreenCallAction} fields={{ id: a.callId! }} className="btn btn-primary">Check for transcript</Act>;
  if (a.kind === "submit") return <Link href={`/sourcing/searches/${a.role!.id}`} className="btn btn-primary">Open role to submit</Link>;
  return a.feeler && a.role ? <CandidateOutreach person={a.person} searchId={a.role.id} feeler={a.feeler} retellLive={live} compact /> : null;
}

export default async function CandidateActions({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const wanted = (await searchParams).kind;
  const kind = Object.keys(KIND).find((k) => k === wanted) as CandidateActionKind | undefined;
  const all = await getCandidateActions({ limit: 300 });
  const shown = (kind ? all.filter((a) => a.kind === kind) : all).slice(0, 40);
  const count = (k: CandidateActionKind) => all.filter((a) => a.kind === k).length;
  const live = retellConfigured();
  return (
    <>
      <PageHeader title="Candidate actions" sub="Who to reach, nudge, screen and submit for your open roles, with the words ready. Each button opens the message for you to send and logs it; the AI screen call is the only one that acts by itself, and only for people who agreed to a call." />
      <div className="mb-4 flex flex-wrap items-center gap-1">
        <Link href="/sourcing/actions" className={`rounded-md px-3 py-1.5 text-sm ${!kind ? "bg-ink font-medium text-white" : "text-stone-600 hover:bg-stone-200"}`}>All ({all.length})</Link>
        {(Object.keys(KIND) as CandidateActionKind[]).filter((k) => count(k) > 0).map((k) => (
          <Link key={k} href={`/sourcing/actions?kind=${k}`} className={`rounded-md px-3 py-1.5 text-sm ${kind === k ? "bg-ink font-medium text-white" : "text-stone-600 hover:bg-stone-200"}`}>{KIND[k][0]} ({count(k)})</Link>
        ))}
      </div>
      {shown.length === 0 ? <Empty>Nothing to do yet. Add a role and candidates, and suggestions appear here.</Empty> : (
        <div className="space-y-2">
          {shown.map((a) => (
            <div key={a.key} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge tone={KIND[a.kind][1]}>{KIND[a.kind][0]}</Badge><Badge tone={a.when === "Today" ? "amber" : "gray"}>{a.when}</Badge>
                    {a.role && <Link href={`/sourcing/searches/${a.role.id}`} className="muted text-xs hover:underline">{a.role.title} · {a.role.client}</Link>}
                  </div>
                  <div className="font-medium">{a.headline}</div>
                  <div className="muted text-sm"><Link href={`/sourcing/candidates/${a.person.id}${a.role ? `?role=${a.role.id}` : ""}`} className="text-brand hover:underline">{a.person.name}</Link>{a.person.title && ` · ${a.person.title}`}</div>
                  <ul className="mt-1.5 space-y-0.5 text-sm">{a.why.map((w, i) => <li key={i} className="flex gap-2"><span className="text-brand">•</span><span>{w}</span></li>)}</ul>
                </div>
              </div>
              <div className="mt-3 border-t border-stone-100 pt-3"><Buttons a={a} live={live} /></div>
              {a.feeler && (a.kind === "reach_out" || a.kind === "nudge") && (
                <details className="mt-2"><summary className="cursor-pointer text-xs font-medium text-brand">See the message</summary><pre className="mt-1 whitespace-pre-wrap rounded-md bg-stone-50 p-2 font-sans text-xs leading-relaxed">{a.feeler.message}</pre></details>
              )}
            </div>
          ))}
        </div>
      )}
      {!live && <p className="muted mt-6 max-w-3xl text-xs">Retell AI is not connected, so the AI screen call button records the request and places no call. Add the Retell keys under Connections to go live.</p>}
    </>
  );
}
