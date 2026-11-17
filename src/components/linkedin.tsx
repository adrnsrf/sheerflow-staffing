"use client";

import { useTransition } from "react";
import { connectionStatusAction, draftMessageAction, queueConnectionAction } from "@/app/actions";

type P = { id: number; name: string; linkedinUrl: string | null; connectionStatus: string; connectionNote: string | null };

/**
 * The LinkedIn steps for one person. Nothing here drives LinkedIn: "Connect" opens the
 * profile in a new tab (with the note on your clipboard) and you press Connect there yourself.
 */
export function LinkedInActions({ person: p, compact = false }: { person: P; compact?: boolean }) {
  const [busy, start] = useTransition();
  const run = (action: (f: FormData) => Promise<void>, fields: Record<string, string | number>) =>
    start(async () => { const f = new FormData(); Object.entries(fields).forEach(([k, v]) => f.set(k, String(v))); await action(f); });
  const open = () => p.linkedinUrl && window.open(p.linkedinUrl, "_blank", "noopener");
  const st = p.connectionStatus;
  if (!p.linkedinUrl) return <span className="muted text-xs">No LinkedIn link</span>;
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${busy ? "opacity-60" : ""}`}>
      {(st === "none" || st === "queued" || st === "note_ready") && (
        <button
          className="btn btn-primary"
          title={p.connectionNote ? "Copies the note, opens the profile in a new tab and marks the request as sent" : "Opens the profile in a new tab and marks the request as sent"}
          onClick={async () => {
            if (p.connectionNote) { try { await navigator.clipboard.writeText(p.connectionNote); } catch { /* clipboard blocked */ } }
            open();
            run(connectionStatusAction, { personId: p.id, status: "sent" });
          }}
        >
          {p.connectionNote ? "Copy note & connect" : "Connect"}
        </button>
      )}
      {st === "none" && <button className="btn" title="Queues a job: Claude writes a note first" onClick={() => run(queueConnectionAction, { personId: p.id })}>Draft note first</button>}
      {st === "queued" && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">Note queued for Claude</span>}
      {st === "sent" && (
        <>
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">Request sent</span>
          <button className="btn" onClick={() => run(connectionStatusAction, { personId: p.id, status: "connected" })}>Mark connected</button>
          {!compact && <button className="btn" title="If you did not send it after all" onClick={() => run(connectionStatusAction, { personId: p.id, status: p.connectionNote ? "note_ready" : "none" })}>Undo</button>}
        </>
      )}
      {st === "connected" && (
        <>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Connected</span>
          <button className="btn" title="Queues a job: Claude drafts a first message for your review" onClick={() => run(draftMessageAction, { personId: p.id })}>Draft message</button>
        </>
      )}
      {st !== "none" && st !== "queued" && st !== "note_ready" && <button className="btn" onClick={open}>Open profile</button>}
    </span>
  );
}
