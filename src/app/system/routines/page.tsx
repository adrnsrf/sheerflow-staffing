import { queueRoutineAction } from "@/app/actions";
import { Act, Badge, PageHeader } from "@/components/ui";
import { listJobs } from "@/core";
import { listRoutines } from "@/core/routines";
import { label, rel } from "@/lib/format";

export default async function Routines() {
  const routines = listRoutines();
  const jobs = await listJobs();
  return (
    <>
      <PageHeader title="Routines" sub="The recurring jobs Claude runs, rewritten to save into this app instead of the sheets. Your original skills are untouched. Queue a run here, then tell Claude to work the queued SheerFlow jobs." />
      <div className="space-y-3">
        {routines.map((r) => {
          const last = jobs.find((j) => j.kind === `routine:${r.id}`);
          return (
            <div key={r.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{r.name}</span><Badge tone="blue">{r.schedule}</Badge></div>
                  <p className="muted mt-1">{r.summary}</p>
                  <p className="muted mt-1 text-xs">Based on: {r.basedOn}</p>
                  {last && <p className="mt-1 text-xs">Last run: <Badge tone={last.status === "done" ? "green" : last.status === "failed" ? "red" : "amber"}>{label(last.status)}</Badge> {rel(last.createdAt)}{last.result && <span className="muted"> · {last.result}</span>}</p>}
                </div>
                <Act action={queueRoutineAction} fields={{ id: r.id }} className="btn btn-primary">Queue a run</Act>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-medium text-brand">Instructions Claude follows</summary>
                <pre className="mt-2 whitespace-pre-wrap rounded-md bg-stone-50 p-3 font-sans text-xs leading-relaxed text-stone-700">{r.prompt}</pre>
              </details>
            </div>
          );
        })}
      </div>
      <p className="muted mt-6 max-w-3xl text-xs leading-relaxed">Each routine is a text file in the <code>routines/</code> folder. Edit the file to change what Claude does. Schedules are notes for now: nothing runs by itself until a scheduled Claude task is pointed at this app.</p>
    </>
  );
}
