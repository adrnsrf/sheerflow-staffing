import Link from "next/link";
import { queueRoutineAction } from "@/app/actions";
import { Act, Badge, PageHeader } from "@/components/ui";
import { listJobs } from "@/core";
import { listContext } from "@/core/context";
import { label, rel } from "@/lib/format";

export default async function Context({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [docs, jobs, q] = await Promise.all([listContext(), listJobs(), searchParams]);
  const group = (kind: string) => docs.filter((d) => d.kind === kind);
  return (
    <>
      <PageHeader title="Claude's instructions" sub="What Claude reads before it works in this app. Guides tell it how you want things done; routines are recurring jobs you can ask it to run. Everything here is yours to edit. Claude can read these but cannot change them.">
        <Link href="/system/context/new" className="btn btn-primary">Write a new one</Link>
      </PageHeader>
      {q.error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{q.error}</div>}
      {([["skill", "Guides"], ["routine", "Routines"]] as const).map(([kind, heading]) => (
        <section key={kind} className="mb-8">
          <h2 className="mb-2 text-sm font-semibold">{heading}</h2>
          <div className="space-y-2">
            {group(kind).map((d) => {
              const last = jobs.find((j) => j.kind === `routine:${d.slug}`);
              return (
                <div key={d.slug} className="card flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/system/context/${d.slug}`} className="font-semibold hover:underline">{d.title}</Link>
                      {d.schedule && <Badge tone="blue">{d.schedule}</Badge>}
                      {d.edited ? <Badge tone="violet">{d.shipped ? "Edited by you" : "Written by you"}</Badge> : <Badge>Original</Badge>}
                    </div>
                    <p className="muted mt-1">{d.summary}</p>
                    {last && <p className="mt-1 text-xs">Last run: <Badge tone={last.status === "done" ? "green" : last.status === "failed" ? "red" : "amber"}>{label(last.status)}</Badge> {rel(last.createdAt)}{last.result && <span className="muted"> · {last.result}</span>}</p>}
                  </div>
                  <div className="flex gap-1.5">
                    {kind === "routine" && <Act action={queueRoutineAction} fields={{ id: d.slug }} className="btn btn-primary" title="Adds this to Claude's list. It runs the next time Claude runs.">Ask Claude to run it</Act>}
                    <Link href={`/system/context/${d.slug}`} className="btn">Open and edit</Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <p className="muted max-w-3xl text-xs leading-relaxed">The schedule on a routine is a reminder of how often it should run. Nothing runs by itself yet: ask Claude to run it, then press Run on the Claude screen.</p>
    </>
  );
}
