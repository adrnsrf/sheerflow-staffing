import { DIMENSIONS, describeDimension, SOURCE_LABEL, type DimensionKey, type Personality } from "@/core/candidate-schema";
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

/** The eight personality scales as tracks, with a marker where the person sits and, optionally, where a role wants them. */
export function PersonalityScales({ personality, wanted, compact = false }: { personality: Personality; wanted?: Partial<Record<DimensionKey, number>>; compact?: boolean }) {
  const pos = (v: number) => `${((v - 1) / 4) * 100}%`;
  return (
    <div className={compact ? "space-y-2" : "space-y-3.5"}>
      {DIMENSIONS.filter((d) => !compact || personality.dimensions[d.key] || wanted?.[d.key]).map((d) => {
        const dim = personality.dimensions[d.key], want = wanted?.[d.key];
        return (
          <div key={d.key}>
            <div className="flex items-baseline justify-between text-xs">
              <span className={dim && dim.value <= 2 ? "font-semibold text-ink" : "muted"}>{d.low}</span>
              <span className="muted text-[10px] uppercase tracking-wide">{d.label}</span>
              <span className={dim && dim.value >= 4 ? "font-semibold text-ink" : "muted"}>{d.high}</span>
            </div>
            <div className="relative mt-1 h-2 rounded-full bg-stone-100">
              {want != null && <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-500 bg-white" style={{ left: pos(want) }} title={`The role wants: ${describeDimension(d.key, want).toLowerCase()}`} />}
              {dim && <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand" style={{ left: pos(dim.value) }} title={describeDimension(d.key, dim.value)} />}
            </div>
            {!compact && (
              <div className="mt-1 text-xs">
                {dim ? <><span className="font-medium">{describeDimension(d.key, dim.value)}.</span>{dim.evidence && <span className="muted"> {dim.evidence}.</span>}<span className="muted"> ({dim.source ? SOURCE_LABEL[dim.source].toLowerCase() : "source not recorded"}{dim.confidence === "inferred" ? ", our reading" : dim.confidence === "stated" ? ", in their words" : ""})</span></> : <span className="muted">Not known yet.</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
