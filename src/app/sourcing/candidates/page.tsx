import Link from "next/link";
import { clearSamplesAction } from "@/app/actions";
import { Act, Badge, Empty, PageHeader } from "@/components/ui";
import { LastContact } from "@/components/history";
import { listCandidates } from "@/core/candidates";
import { lastContacts } from "@/core/history";
import { searchCandidates } from "@/core/matching";

export default async function Candidates({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim();
  const [all, worked] = await Promise.all([listCandidates(), lastContacts()]);
  const hits = q ? await searchCandidates(q, 30) : null;
  const byId = new Map(all.map((c) => [c.person.id, c]));
  const rows = hits ? hits.map((h) => ({ ...byId.get(h.personId)!, hit: h })).filter((r) => r.person) : all.map((c) => ({ ...c, hit: null }));
  const samples = all.filter((c) => c.cp.isSample).length;
  return (
    <>
      <PageHeader title="Candidates" sub="One compiled profile per candidate, built from LinkedIn, resumes, applications, screen calls and messages. Search in plain words: the list is ranked by how closely each profile reads to what you typed.">
        <Link href="/sourcing/candidates/new" className="btn btn-primary">Add a candidate</Link>
      </PageHeader>
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder='Describe who you need, e.g. "built a data stack alone at a startup" or "Power BI developer good with business users"' className="field flex-1" />
        <button className="btn btn-primary px-4">Search</button>
        {q && <Link href="/sourcing/candidates" className="btn">Clear</Link>}
      </form>
      {rows.length === 0 ? <Empty>No candidates yet. Add one, or let a Claude run compile them from applications.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr>{hits && <th>Closeness</th>}<th>Candidate</th><th>Top tools (years)</th><th>Where</th><th>Pay wanted</th><th>Profile</th></tr></thead>
            <tbody>
              {rows.map(({ person, cp, hit }) => {
                const p = cp.profile;
                return (
                  <tr key={person.id} className="hover:bg-stone-50">
                    {hit && <td className="tabular-nums"><span className="font-semibold">{hit.similarity.toFixed(2)}</span>{hit.toolHits.length > 0 && <div className="muted text-xs">{hit.toolHits.join(", ")}</div>}</td>}
                    <td><Link href={`/sourcing/candidates/${person.id}`} className="font-medium text-brand hover:underline">{person.name}</Link>{cp.isSample && <> <Badge>Sample</Badge></>} <LastContact c={worked.get(person.id)} /><div className="muted max-w-64 text-xs">{p.headline}{p.totalYears ? ` · ${p.totalYears} yrs` : ""}</div>{hit && <div className="mt-1 max-w-md text-xs text-stone-600"><span className="font-medium">{hit.matchedOn}:</span> {hit.snippet}{hit.snippet.length >= 220 && "…"}</div>}</td>
                    <td className="max-w-72 text-xs">{[...p.skills].sort((a, b) => b.years - a.years).slice(0, 5).map((sk) => `${sk.name} ${sk.years}`).join(" · ")}</td>
                    <td className="text-xs">{[p.location.city, p.location.state].filter(Boolean).join(", ")}<div className="muted">{p.location.workplace ?? "Preference unknown"}</div></td>
                    <td className="text-xs tabular-nums">{p.compensation.targetBase ? <>${Math.round(p.compensation.targetBase / 1000)}k{p.compensation.minimumBase && p.compensation.minimumBase !== p.compensation.targetBase && <div className="muted">min ${Math.round(p.compensation.minimumBase / 1000)}k</div>}</> : <span className="muted">Unknown</span>}</td>
                    <td><Badge tone={cp.completeness >= 80 ? "green" : cp.completeness >= 50 ? "amber" : "red"}>{cp.completeness}% known</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {samples > 0 && (
        <div className="muted mt-6 flex items-center gap-3 text-xs">
          <span>{samples} of these are made-up sample candidates, there to try search and matching.</span>
          <Act action={clearSamplesAction} fields={{}} className="btn btn-danger" title="Deletes the sample candidates and sample roles. Your own are kept.">Remove sample candidates and roles</Act>
        </div>
      )}
    </>
  );
}
