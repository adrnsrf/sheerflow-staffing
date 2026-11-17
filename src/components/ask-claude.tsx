import Link from "next/link";
import { cache } from "react";
import { queueJobAction } from "@/app/actions";
import { jobKey, listJobs } from "@/core";

/** The jobs waiting for Claude, read once per page however many buttons ask. */
export const queuedJobKeys = cache(async () => new Set((await listJobs({ status: "queued" })).map((j) => jobKey(j.kind, j.payload))));

/**
 * A button that hands a piece of work to Claude. Once pressed it turns into a
 * "Queued for Claude" marker, so it is clear the request was taken and it cannot be sent twice.
 */
export async function AskClaude({ kind, title, payload = {}, children, className = "btn" }: { kind: string; title: string; payload?: Record<string, unknown>; children: React.ReactNode; className?: string }) {
  if ((await queuedJobKeys()).has(jobKey(kind, payload))) {
    return <Link href="/system/claude" className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100" title="Waiting for the next Claude run. Click to see the queue or start a run.">✓ Queued for Claude</Link>;
  }
  return (
    <form action={queueJobAction} className="inline">
      <input type="hidden" name="kind" value={kind} /><input type="hidden" name="title" value={title} /><input type="hidden" name="payload" value={JSON.stringify(payload)} />
      <button className={className} title="Adds this to Claude's to-do list. It is done the next time Claude runs.">{children}</button>
    </form>
  );
}
