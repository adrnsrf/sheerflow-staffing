import type { Match } from "@/core/matching";
import { Badge } from "@/components/ui";

/** Tools the role asks for, each with the years the candidate has against the years needed. */
export function ToolFit({ tools }: { tools: Match["tools"] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tools.map((t) => {
        const ok = t.has >= t.need, some = t.has > 0;
        return (
          <span key={t.name} title={`${t.must ? "Must have" : "Nice to have"}: role asks ${t.need}+ years, candidate has ${t.has}`}
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ok ? "bg-emerald-50 text-emerald-700" : some ? "bg-amber-50 text-amber-800" : t.must ? "bg-rose-50 text-rose-700" : "bg-stone-100 text-stone-500"}`}>
            {t.name} {some ? `${t.has}y` : "none"}<span className="opacity-60">/{t.need}y</span>{!t.must && <span className="opacity-60"> opt</span>}
          </span>
        );
      })}
    </div>
  );
}

export function MatchScore({ m }: { m: Match }) {
  return (
    <div className="w-24 shrink-0 text-center">
      <div className={`text-2xl font-semibold tabular-nums ${m.score >= 80 ? "text-emerald-700" : m.score >= 65 ? "text-brand" : "text-stone-500"}`}>{m.score}</div>
      <div className="muted text-[10px] leading-tight">requirements {m.structured}<br />similarity {m.similarity}</div>
    </div>
  );
}

export function MatchWhy({ m }: { m: Match }) {
  return (
    <div className="mt-1.5 space-y-0.5 text-xs">
      {m.missingMust.length > 0 && <div><Badge tone="red">Missing a must-have: {m.missingMust.join(", ")}</Badge></div>}
      {m.parts.slice(1).map((p) => (
        <div key={p.label} className="flex gap-2"><span className={`w-3 shrink-0 ${p.score >= 0.7 ? "text-emerald-600" : p.score >= 0.4 ? "text-amber-600" : "text-rose-600"}`}>{p.score >= 0.7 ? "✓" : p.score >= 0.4 ? "~" : "✗"}</span><span className="muted w-24 shrink-0">{p.label}</span><span>{p.note}</span></div>
      ))}
    </div>
  );
}
