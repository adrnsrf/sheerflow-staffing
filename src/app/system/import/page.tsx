import fs from "node:fs";
import path from "node:path";
import { importAction } from "@/app/actions";
import { PageHeader } from "@/components/ui";
import { IMPORTS_DIR } from "@/db/client";

const SOURCES = [
  { kind: "call-list", name: "DFC call sheet", from: "Google Sheet \"Call List - Nov 2026\", tab \"List 1 - Nov 2026\"", to: "Accounts, People, Call list, and one logged call per dated entry in DFC Notes", csv: true },
  { kind: "hiring-posts", name: "LinkedIn hiring posts", from: "Google Sheet \"LinkedIn Hiring Posts\", tab \"Posts\"", to: "Signals inbox, People (the posters) and Accounts", csv: true },
  { kind: "job-alerts", name: "LinkedIn job alerts", from: "LinkedIn job alert emails in Gmail, read by a Claude run", to: "Job alerts", csv: false },
] as const;

function fileInfo(kind: string) {
  const file = path.join(IMPORTS_DIR, `${kind}.json`);
  if (!fs.existsSync(file)) return null;
  try { return { rows: (JSON.parse(fs.readFileSync(file, "utf8")) as unknown[]).length, modified: fs.statSync(file).mtime }; } catch { return { rows: -1, modified: new Date() }; }
}

export default async function Import({ searchParams }: { searchParams: Promise<{ done?: string; result?: string; error?: string }> }) {
  const q = await searchParams;
  return (
    <>
      <PageHeader title="Import" sub="Bring over what the routines have produced so far. Every import can be run again: it adds what is new, skips what it has seen, and keeps the original row so no column is lost." />
      {q.error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{q.error}</div>}
      {q.done && <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900"><span className="font-semibold">{SOURCES.find((x) => x.kind === q.done)?.name} imported.</span> {q.result}</div>}
      <div className="space-y-3">
        {SOURCES.map((src) => {
          const info = fileInfo(src.kind);
          return (
            <div key={src.kind} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="text-sm">
                  <div className="font-semibold">{src.name}</div>
                  <div className="muted">From: {src.from}</div>
                  <div className="muted">Goes to: {src.to}</div>
                  <div className="mt-1 text-xs">{info ? <>File <code className="rounded bg-stone-100 px-1">imports/{src.kind}.json</code> has {info.rows} rows (saved {info.modified.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}).</> : <span className="muted">No file at imports/{src.kind}.json yet.</span>}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {info && <form action={importAction}><input type="hidden" name="kind" value={src.kind} /><button className="btn btn-primary">Import {info.rows} rows from file</button></form>}
                  {src.csv && (
                    <form action={importAction} className="flex items-center gap-2">
                      <input type="hidden" name="kind" value={src.kind} />
                      <input type="file" name="file" accept=".csv" required className="w-56 text-xs" />
                      <button className="btn">Import a CSV</button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="muted mt-6 max-w-3xl text-xs leading-relaxed">
        Two ways to refresh: in Google Sheets use File, Download, Comma-separated values and upload it here, or let a Claude run copy rows across with its Google connection. The <code>imports/</code> folder holds real contact data and is never committed to the repository.
      </p>
    </>
  );
}
