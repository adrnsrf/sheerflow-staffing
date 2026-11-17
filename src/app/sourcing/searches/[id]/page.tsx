import Link from "next/link";
import { notFound } from "next/navigation";
import { addToSearchAction, candidateStageAction, queueJobAction, saveRoleAction } from "@/app/actions";
import { MatchScore, MatchWhy, ToolFit } from "@/components/candidate";
import { Act, Badge, PageHeader } from "@/components/ui";
import { getSearch } from "@/core";
import { SIZE_LABEL } from "@/core/candidate-schema";
import { matchRole } from "@/core/matching";
import type { CandidateStage } from "@/db/schema";
import { label } from "@/lib/format";

const STAGES: CandidateStage[] = ["sourced", "contacted", "screened", "submitted", "interview", "offer", "placed", "rejected"];

export default async function Role({ params }: { params: Promise<{ id: string }> }) {
  const data = await getSearch(Number((await params).id));
  if (!data) notFound();
  const { search, client, candidates } = data;
  const matches = await matchRole(search.id, 12);
  const req = search.requirements;
  const inPipeline = new Set(candidates.map((c) => c.person.id));
  return (
    <>
      <div className="muted mb-2 text-xs"><Link href="/sourcing/searches" className="hover:underline">Roles</Link> / {search.title}</div>
      <PageHeader title={search.title} sub={[client, search.compRange].filter(Boolean).join(" · ")}>
        {search.isSample && <Badge>Sample</Badge>}
        <Badge tone={search.status === "open" ? "green" : "amber"}>{label(search.status)}</Badge>
        <Act action={queueJobAction} fields={{ kind: "source_candidates", title: `Source candidates for ${search.title}`, payload: JSON.stringify({ searchId: search.id }) }} title="Queues a job for the next Claude run">Ask Claude to source more</Act>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-4 text-sm lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold">Job description</h2>
          <p className="whitespace-pre-line leading-relaxed">{search.description ?? "No description yet."}</p>
        </section>
        <section className="card p-4 text-sm">
          <h2 className="mb-2 text-sm font-semibold">What it requires</h2>
          {!req ? <p className="muted">Not set.</p> : (
            <>
              <table className="w-full text-sm"><tbody>
                {req.tools.map((t) => <tr key={t.name}><td className="py-0.5 font-medium">{t.name}</td><td className="tabular-nums">{t.minYears}+ yrs</td><td className="text-right">{t.must ? <Badge tone="teal">Must</Badge> : <Badge>Nice</Badge>}</td></tr>)}
              </tbody></table>
              <dl className="mt-3 space-y-1 text-xs">
                {[["Experience", req.minTotalYears ? `${req.minTotalYears}+ years` : null], ["Company", req.companySize ? SIZE_LABEL[req.companySize] : null], ["Where", [req.workplace && label(req.workplace), [req.city, req.state].filter(Boolean).join(", ")].filter(Boolean).join(", ") || null], ["Pay up to", req.maxBase ? `$${Math.round(req.maxBase / 1000)}k` : null]].map(([key, val]) => (
                  <div key={key as string} className="flex gap-2"><dt className="muted w-20">{key}</dt><dd className={val ? "" : "muted"}>{val ?? "Not stated"}</dd></div>
                ))}
              </dl>
            </>
          )}
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium text-brand">Edit the description or requirements</summary>
            <form action={saveRoleAction} className="mt-2 space-y-2">
              <input type="hidden" name="id" value={search.id} /><input type="hidden" name="title" value={search.title} /><input type="hidden" name="clientName" value={search.clientName ?? ""} />
              <textarea name="description" rows={6} defaultValue={search.description ?? ""} className="field w-full text-xs" />
              <textarea name="requirements" rows={12} defaultValue={JSON.stringify(req, null, 2)} className="field w-full font-mono text-[11px]" spellCheck={false} />
              <button className="btn">Save and rematch</button>
            </form>
          </details>
        </section>
      </div>

      <h2 className="mt-8 mb-1 text-sm font-semibold">Best matches</h2>
      <p className="muted mb-3 max-w-3xl text-xs">Score = 65% requirements (tools at the years asked, experience, company size, location, pay) + 35% similarity (how closely the whole profile reads to this job description). Anyone missing a must-have tool is capped at 55.</p>
      <div className="space-y-2">
        {matches.map((m) => (
          <div key={m.personId} className="card flex items-start gap-4 p-4">
            <MatchScore m={m} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2"><Link href={`/sourcing/candidates/${m.personId}`} className="font-semibold text-brand hover:underline">{m.name}</Link><span className="muted text-sm">{m.headline}</span></div>
              <div className="mt-1.5"><ToolFit tools={m.tools} /></div>
              <MatchWhy m={m} />
            </div>
            <div className="shrink-0">{inPipeline.has(m.personId) ? <Badge tone="green">In pipeline</Badge> : <Act action={addToSearchAction} fields={{ searchId: search.id, personId: m.personId, fitScore: m.score, fitNotes: m.parts[0].note }} className="btn btn-primary">Add to pipeline</Act>}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-8 mb-2 text-sm font-semibold">Pipeline ({candidates.length})</h2>
      {candidates.length === 0 ? <div className="card muted p-6 text-center text-sm">Nobody yet. Add people from the matches above.</div> : (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Candidate</th><th>Match</th><th>Source</th><th>Stage</th></tr></thead>
            <tbody>
              {candidates.map(({ link, person }) => (
                <tr key={link.id}>
                  <td><Link href={`/sourcing/candidates/${person.id}`} className="font-medium text-brand hover:underline">{person.name}</Link><div className="muted text-xs">{person.title}</div></td>
                  <td><div className="font-semibold tabular-nums">{link.fitScore}</div><div className="muted max-w-56 text-xs">{link.fitNotes}</div></td>
                  <td className="muted text-xs">{link.source}</td>
                  <td>
                    <form action={candidateStageAction} className="flex gap-1.5">
                      <input type="hidden" name="id" value={link.id} />
                      <select name="stage" defaultValue={link.stage} className="field py-1 text-xs">{STAGES.map((st) => <option key={st} value={st}>{label(st)}</option>)}</select>
                      <button className="btn">Move</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
