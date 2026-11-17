import { headers } from "next/headers";
import { queueJobAction } from "@/app/actions";
import { CopyButton } from "@/components/client";
import { Act, Badge, PageHeader } from "@/components/ui";
import { listJobs } from "@/core";
import { label, rel } from "@/lib/format";

const QUICK: [string, string][] = [
  ["find_new_signals", "Run the daily LinkedIn hiring posts search"], ["draft_connection_notes", "Write notes for everyone ticked Connect?"], ["weekly_review", "Write this week's sales review"],
];

export default async function Claude() {
  const jobs = await listJobs();
  const url = `http://${(await headers()).get("host") ?? "localhost:3000"}/api/mcp`;
  const cmd = `claude mcp add --transport http sheerflow ${url}`;
  return (
    <>
      <PageHeader title="Claude" sub="The app is a tool Claude uses, not an app that calls Claude. Buttons queue jobs here; a Claude run picks them up over the connection below and writes results back." />
      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card lg:col-span-3">
          <h2 className="border-b border-stone-200 px-4 py-3 text-sm font-semibold">Job queue</h2>
          {jobs.map((j) => (
            <div key={j.id} className="border-b border-stone-100 px-4 py-2.5 text-sm last:border-b-0">
              <div className="flex items-center justify-between gap-2">
                <span><span className="muted mr-2 font-mono text-xs">#{j.id}</span>{j.title}</span>
                <Badge tone={j.status === "queued" ? "amber" : j.status === "done" ? "green" : j.status === "failed" ? "red" : "blue"}>{label(j.status)}</Badge>
              </div>
              <div className="muted text-xs">{j.kind} · queued {rel(j.createdAt)}{j.result && <> · <span className="text-stone-700">{j.result}</span></>}</div>
            </div>
          ))}
          <div className="flex flex-wrap gap-1.5 p-3">
            {QUICK.map(([kind, title]) => <Act key={kind} action={queueJobAction} fields={{ kind, title }}>+ {title}</Act>)}
          </div>
        </section>
        <section className="space-y-4 lg:col-span-2">
          <div className="card p-4 text-sm">
            <h2 className="mb-2 text-sm font-semibold">Connect Claude</h2>
            <p className="muted mb-2">With the app running, add it to Claude Code:</p>
            <pre className="whitespace-pre-wrap break-all rounded-md bg-ink p-3 text-xs text-stone-100">{cmd}</pre>
            <div className="mt-2"><CopyButton text={cmd}>Copy command</CopyButton></div>
            <p className="muted mt-3">Then ask things like:</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>What are the hottest new signals in SheerFlow?</li>
              <li>Who is due a call today, and which numbers look bad?</li>
              <li>Work the queued SheerFlow jobs.</li>
            </ul>
          </div>
          <div className="card p-4 text-sm">
            <h2 className="mb-2 text-sm font-semibold">What Claude can do</h2>
            <p><span className="font-medium">Read:</span> <span className="muted">overview, signals, companies, accounts with phone numbers and call log, people, call list, job alerts, KPIs, talent pool, jobs, and the AI context store.</span></p>
            <p className="mt-1"><span className="font-medium">Write:</span> <span className="muted">add companies, signals, job alert emails and sheet rows (all deduped), log calls, save phone numbers with their source, add staffing firms, queue connections, save notes and drafts, add tasks, record credits, complete jobs.</span></p>
            <p className="mt-1"><span className="font-medium">Never:</span> <span className="muted">send email, send a LinkedIn request, spend Apollo credits, or change its own instructions.</span></p>
          </div>
        </section>
      </div>
    </>
  );
}
