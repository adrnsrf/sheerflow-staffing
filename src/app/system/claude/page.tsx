import { headers } from "next/headers";
import { cancelJobAction, queueBatchAction, queueJobAction, runClaudeAction } from "@/app/actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { CopyButton } from "@/components/client";
import { Act, Badge, PageHeader } from "@/components/ui";
import { listJobs } from "@/core";
import { claudeInstalled, currentRun, listRuns } from "@/core/claude-runner";
import { label, rel } from "@/lib/format";

const QUICK: [string, string][] = [["routine:daily-hiring-posts", "Find today's LinkedIn hiring posts"], ["routine:gmail-job-alerts", "Read new job alert emails"], ["weekly_review", "Write this week's sales review"]];
const BATCHES: [string, string, string][] = [
  ["follow_ups", "Follow-up drafts", "For people who spoke with you and have had nothing since"],
  ["notes", "Connection notes", "For the best people to connect with on LinkedIn"],
  ["briefs", "Company briefs", "For the strongest companies that have none"],
  ["research", "Phone research", "For rows stuck on a bad number or wrong contact"],
];
const time = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export default async function Claude({ searchParams }: { searchParams: Promise<{ error?: string; run?: string; batch?: string }> }) {
  const [jobs, run, runs, q] = await Promise.all([listJobs(), currentRun(), listRuns(), searchParams]);
  const waiting = jobs.filter((j) => j.status === "queued"), finished = jobs.filter((j) => j.status !== "queued").slice(0, 12);
  const installed = claudeInstalled(), running = run?.status === "running";
  const url = `http://${(await headers()).get("host") ?? "localhost:3000"}/api/mcp`;
  return (
    <>
      {running && <AutoRefresh seconds={5} />}
      <PageHeader title="Claude" sub="Buttons across the app hand work to Claude: drafts, research, reading resumes. That work waits here until Claude runs. Press Run to have Claude do it now, on this computer, with your Claude account." />
      {q.error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{q.error}</div>}
      {q.batch && <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">{Number(q.batch) > 0 ? `Added ${q.batch} job${q.batch === "1" ? "" : "s"} to the waiting list. Press Run Claude now to start.` : "Nothing to add: those are already done or already waiting."}</div>}
      <section className={`card mb-6 flex flex-wrap items-center justify-between gap-4 p-5 ${running ? "border-violet-300 bg-violet-50" : ""}`}>
        <div className="text-sm">
          {running ? <><div className="text-base font-semibold">Claude is working…</div><div className="muted">Started {time(run!.startedAt)} with {run!.jobsWaiting} job{run!.jobsWaiting === 1 ? "" : "s"} waiting. This page updates by itself; you can keep using the app.</div></>
            : waiting.length ? <><div className="text-base font-semibold">{waiting.length} job{waiting.length === 1 ? "" : "s"} waiting for Claude</div><div className="muted">{run ? `Last run ${rel(run.startedAt)} at ${time(run.startedAt)}: ${run.status === "finished" ? `finished ${run.jobsDone} job${run.jobsDone === 1 ? "" : "s"}` : "did not finish"}.` : "Claude has not run yet."}</div></>
            : <><div className="text-base font-semibold">Nothing waiting</div><div className="muted">{run ? `Last run ${rel(run.startedAt)} at ${time(run.startedAt)}.` : "Work you hand to Claude will show up here."}</div></>}
        </div>
        {!running && waiting.length > 0 && installed && <Act action={runClaudeAction} fields={{}} className="btn btn-primary px-5 py-2 text-sm">Run Claude now</Act>}
        {!installed && <div className="max-w-sm text-xs text-rose-700">Claude Code is not installed on this computer, so the app cannot start a run. See Setup below.</div>}
      </section>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <section className="card">
            <h2 className="border-b border-stone-200 px-4 py-3 text-sm font-semibold">Waiting ({waiting.length})</h2>
            {waiting.length === 0 && <p className="muted p-4 text-sm">Nothing waiting.</p>}
            {waiting.map((j) => (
              <div key={j.id} className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-2.5 text-sm last:border-b-0">
                <span className="min-w-0"><span className="block truncate">{j.title}</span><span className="muted text-xs">Asked {rel(j.createdAt)}</span></span>
                <Act action={cancelJobAction} fields={{ id: j.id }} className="btn btn-danger" title="Take this off Claude's list">Remove</Act>
              </div>
            ))}
            <div className="flex flex-wrap gap-1.5 border-t border-stone-100 p-3">{QUICK.map(([kind, title]) => <Act key={kind} action={queueJobAction} fields={{ kind, title }}>+ {title}</Act>)}</div>
          </section>
          <section className="card p-4 text-sm">
            <h2 className="font-semibold">Hand Claude a batch</h2>
            <p className="muted mt-0.5 text-xs">Takes the strongest items from your to-do list and adds them to the waiting list above. Then press Run. Each run works up to 15 jobs; press Run again for the rest.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {BATCHES.map(([kind, name, help]) => (
                <form key={kind} action={queueBatchAction} className="flex items-center gap-2 rounded-lg border border-stone-200 p-2.5">
                  <input type="hidden" name="kind" value={kind} />
                  <span className="min-w-0 flex-1"><span className="block font-medium">{name}</span><span className="muted block text-xs">{help}</span></span>
                  <select name="count" defaultValue="10" className="field py-1 text-xs">{[5, 10, 15, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}</select>
                  <button className="btn">Add</button>
                </form>
              ))}
            </div>
          </section>
          <section className="card">
            <h2 className="border-b border-stone-200 px-4 py-3 text-sm font-semibold">Done recently</h2>
            {finished.length === 0 && <p className="muted p-4 text-sm">Nothing yet.</p>}
            {finished.map((j) => (
              <div key={j.id} className="border-b border-stone-100 px-4 py-2.5 text-sm last:border-b-0">
                <div className="flex items-center justify-between gap-2"><span className="truncate">{j.title}</span><Badge tone={j.status === "done" ? "green" : "red"}>{j.status === "done" ? "Done" : "Could not do"}</Badge></div>
                {j.result && <div className="muted mt-0.5 text-xs">{j.result}</div>}
              </div>
            ))}
          </section>
        </div>
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-4 text-sm">
            <h2 className="mb-2 text-sm font-semibold">Runs</h2>
            {runs.length === 0 && <p className="muted">No runs yet.</p>}
            {runs.map((r) => (
              <details key={r.id} className="border-b border-stone-100 py-2 last:border-b-0">
                <summary className="flex cursor-pointer items-center justify-between gap-2"><span>{rel(r.startedAt)} at {time(r.startedAt)} <span className="muted">· {r.startedBy === "schedule" ? "scheduled" : "you pressed Run"}</span></span><Badge tone={r.status === "finished" ? "green" : r.status === "running" ? "violet" : "red"}>{r.status === "finished" ? `${r.jobsDone} of ${r.jobsWaiting} done` : label(r.status)}</Badge></summary>
                {r.summary && <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-md bg-stone-50 p-2 font-sans text-xs leading-relaxed">{r.summary}</pre>}
              </details>
            ))}
          </section>
          <section className="card p-4 text-sm">
            <h2 className="mb-2 text-sm font-semibold">What Claude may do here</h2>
            <p><span className="font-medium">Read</span> <span className="muted">everything in the app, and search the web for research.</span></p>
            <p className="mt-1"><span className="font-medium">Write</span> <span className="muted">drafts, notes, profiles, phone numbers, signals and results, into the app only.</span></p>
            <p className="mt-1"><span className="font-medium">Never</span> <span className="muted">send an email, contact anyone on LinkedIn, spend Apollo credits, or change its own instructions.</span></p>
          </section>
          <details className="card p-4 text-sm">
            <summary className="cursor-pointer font-semibold">Setup (for whoever installs this)</summary>
            <div className="mt-3 space-y-3 text-xs leading-relaxed">
              <p><span className="font-medium">Run button.</span> Needs Claude Code installed and signed in on this computer. Status: {installed ? "found." : "not found."}</p>
              <p><span className="font-medium">Run on a schedule.</span> Have a scheduled task call this address while the app is running, for example every weekday at 7am:</p>
              <pre className="whitespace-pre-wrap break-all rounded-md bg-ink p-2 text-stone-100">{`curl -X POST ${url.replace("/api/mcp", "/api/claude/run")}`}</pre>
              <p><span className="font-medium">Use Claude yourself.</span> To chat with your data from Claude Code, connect it once:</p>
              <pre className="whitespace-pre-wrap break-all rounded-md bg-ink p-2 text-stone-100">{`claude mcp add --transport http sheerflow ${url}`}</pre>
              <CopyButton text={`claude mcp add --transport http sheerflow ${url}`}>Copy command</CopyButton>
              <p><span className="font-medium">Gmail and Apollo in runs.</span> A run can only use this app and web search unless more read-only tools are listed in CLAUDE_EXTRA_TOOLS in .env.local.</p>
            </div>
          </details>
        </div>
      </div>
    </>
  );
}
