import Link from "next/link";
import type { ReactNode } from "react";
import { getSetting } from "@/core";

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="muted mt-1 max-w-3xl text-sm">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

const TONES = {
  gray: "bg-stone-100 text-stone-600", green: "bg-emerald-50 text-emerald-700", teal: "bg-teal-50 text-teal-700", amber: "bg-amber-50 text-amber-800",
  red: "bg-rose-50 text-rose-700", blue: "bg-sky-50 text-sky-700", violet: "bg-violet-50 text-violet-700",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${TONES[tone]}`}>{children}</span>;
}

export const tierTone = (t: string | null | undefined): Tone => (t === "A" ? "green" : t === "B" ? "blue" : "gray");
export function Tier({ tier, score }: { tier: string | null | undefined; score?: number | null }) {
  if (!tier) return null;
  return <Badge tone={tierTone(tier)}>Tier {tier}{score != null && ` · ${score}`}</Badge>;
}

export function Stat({ label, value, hint, href, tone }: { label: string; value: ReactNode; hint?: string; href?: string; tone?: "warn" }) {
  const body = (
    <div className={`card h-full p-4 ${href ? "transition hover:border-brand" : ""}`}>
      <div className="muted text-xs font-medium">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "warn" ? "text-rose-700" : ""}`}>{value}</div>
      {hint && <div className="muted mt-1 text-xs">{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card muted p-8 text-center text-sm">{children}</div>;
}

/** A one-button form that calls a server action with hidden fields. */
export function Act({ action, fields, children, className = "btn", title }: { action: (f: FormData) => Promise<void>; fields: Record<string, string | number>; children: ReactNode; className?: string; title?: string }) {
  return (
    <form action={action} className="inline">
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button className={className} title={title}>{children}</button>
    </form>
  );
}

/** Shown only while the app is filled with made-up sample data. */
export async function SampleNote({ children }: { children?: ReactNode }) {
  if (!(await getSetting<boolean>("sample_data"))) return null;
  return <p className="muted mt-6 text-xs">{children ?? "Sample data. Every company, person and number on this screen is made up."}</p>;
}
