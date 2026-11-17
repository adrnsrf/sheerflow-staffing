"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { connectionStatusAction, outreachAction, screenCallAction } from "@/app/actions";

type P = { id: number; name: string; linkedinUrl: string | null; connectionStatus: string; email: string | null; phone: string | null; aiContactConsent: boolean };
type F = { note: string; message: string; emailSubject: string; emailBody: string; text: string };

/**
 * One-click outreach to a candidate about a role. Each button copies or pre-fills the words,
 * opens the place to send them (LinkedIn, Gmail, the messaging app) and logs the touch.
 * Adrian presses send there. The AI screen call is the only button that acts by itself, and it
 * is locked until the candidate has agreed to a call.
 */
export function CandidateOutreach({ person: p, searchId, feeler, retellLive, compact = false }: { person: P; searchId: number; feeler: F; retellLive: boolean; compact?: boolean }) {
  const [busy, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = (fields: Record<string, string | number>) => { const f = new FormData(); Object.entries(fields).forEach(([k, v]) => f.set(k, String(v))); return f; };
  const log = (channel: string, label: string) => start(async () => { await outreachAction(form({ personId: p.id, searchId, channel })); setDone(label); });
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); } catch { /* clipboard blocked: the tab still opens */ } };
  const open = (url: string) => window.open(url, "_blank", "noopener");
  const first = p.name.split(" ")[0];
  const st = p.connectionStatus;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${busy ? "opacity-60" : ""}`}>
      {p.linkedinUrl && st === "connected" && (
        <button className="btn btn-primary" title="Copies the message, opens their profile and logs it. Paste it into a LinkedIn message and send." onClick={async () => { await copy(feeler.message); open(p.linkedinUrl!); log("linkedin_message", "LinkedIn message copied") }}>Message on LinkedIn</button>
      )}
      {p.linkedinUrl && (st === "none" || st === "queued" || st === "note_ready") && (
        <button className="btn btn-primary" title={`Copies this note (${feeler.note.length} of 300 characters), opens their profile and marks the request as sent. Press Connect there and paste the note.`} onClick={async () => { await copy(feeler.note); open(p.linkedinUrl!); log("linkedin_connect", "Note copied, request marked sent") }}>Connect with role note</button>
      )}
      {p.linkedinUrl && st === "sent" && (
        <>
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">Request sent</span>
          <button className="btn" onClick={() => start(async () => { await connectionStatusAction(form({ personId: p.id, status: "connected" })); })}>Mark connected</button>
        </>
      )}
      {p.email
        ? <button className="btn" title="Opens Gmail with the email written. Read it, then press Send there." onClick={() => { open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(p.email!)}&su=${encodeURIComponent(feeler.emailSubject)}&body=${encodeURIComponent(feeler.emailBody)}`); log("email", "Email opened in Gmail") }}>Email</button>
        : !compact && <span className="muted text-xs">No email</span>}
      {p.phone && (
        <button className="btn" title="Copies the text and opens your messaging app with it filled in. Press send there." onClick={async () => { await copy(feeler.text); window.location.href = `sms:${p.phone!.replace(/[^+\d]/g, "")}?&body=${encodeURIComponent(feeler.text)}`; log("text", "Text copied and opened") }}>Text</button>
      )}
      {p.phone && p.aiContactConsent && (
        <button className="btn" title={retellLive ? `Places an AI screen call to ${first} now` : "Retell is not connected yet: this records the request and shows the screener's brief, but places no call"} onClick={() => start(async () => { const r = await screenCallAction(form({ personId: p.id, searchId })); if (r.error) setError(r.error); else setDone(r.message ?? "Requested"); })}>{retellLive ? "Start AI screen call" : "AI screen call (not connected)"}</button>
      )}
      {p.phone && !p.aiContactConsent && !compact && <Link href={`/sourcing/candidates/${p.id}#consent`} className="btn" title="An automated call needs the candidate's agreement first. Record it on their profile.">AI call needs consent</Link>}
      {!p.phone && !compact && <span className="muted text-xs">No phone</span>}
      {done && <span className="text-xs font-medium text-emerald-700">{done}</span>}
      {error && <span className="text-xs font-medium text-rose-700">{error}</span>}
    </div>
  );
}
