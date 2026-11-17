import Link from "next/link";
import { notFound } from "next/navigation";
import { candidateStageAction, queueJobAction } from "@/app/actions";
import { Act, Badge, PageHeader, SampleNote } from "@/components/ui";
import { getSearch } from "@/core";
import type { CandidateStage } from "@/db/schema";
import { label } from "@/lib/format";

const STAGES: CandidateStage[] = ["sourced", "contacted", "screened", "submitted", "interview", "offer", "placed", "rejected"];

export default async function Search({ params }: { params: Promise<{ id: string }> }) {
  const data = await getSearch(Number((await params).id));
  if (!data) notFound();
  const { search, company, candidates } = data;
  return (
    <>
      <div className="muted mb-2 text-xs"><Link href="/sourcing/searches" className="hover:underline">Searches</Link> / {search.title}</div>
      <PageHeader title={search.title} sub={`${company.name} · ${search.compRange}`}>
        <Badge tone={search.status === "open" ? "green" : "amber"}>{label(search.status)}</Badge>
        <Act action={queueJobAction} fields={{ kind: "source_candidates", title: `Source candidates for ${search.title} at ${company.name}`, payload: JSON.stringify({ searchId: search.id }) }} title="Queues a job for the next Claude run">Ask Claude to source more</Act>
      </PageHeader>
      <section className="card mb-6 grid gap-x-8 gap-y-3 p-4 text-sm sm:grid-cols-2">
        {[["Must-haves", search.mustHaves], ["Stack", search.stack], ["Process", search.process], ["Selling points", search.sellingPoints]].map(([k, v]) => (
          <div key={k}><div className="muted text-xs font-medium">{k}</div><div>{v}</div></div>
        ))}
      </section>
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Candidate</th><th>Fit</th><th>Skills</th><th>Source</th><th>Stage</th></tr></thead>
          <tbody>
            {candidates.map(({ link, person }) => (
              <tr key={link.id}>
                <td><div className="font-medium">{person.name}</div><div className="muted text-xs">{person.title} at {person.currentEmployer} · {person.location}</div></td>
                <td><div className="font-semibold tabular-nums">{link.fitScore}</div><div className="muted max-w-56 text-xs">{link.fitNotes}</div></td>
                <td className="max-w-56 text-xs">{person.skills}</td>
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
      <SampleNote>Sample data. Screens (guide, scorecard, notes) and one-click submittal packets hang off each candidate row in the next phase.</SampleNote>
    </>
  );
}
