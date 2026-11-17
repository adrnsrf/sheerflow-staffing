import { Badge, Empty, PageHeader, SampleNote } from "@/components/ui";
import { listTalentPool } from "@/core";

export default async function Talent({ searchParams }: { searchParams: Promise<{ skill?: string }> }) {
  const { skill } = await searchParams;
  const rows = await listTalentPool({ skill });
  return (
    <>
      <PageHeader title="Talent pool" sub="Everyone you've seen before, searchable by skill and stack, so a new role starts warm.">
        <form className="flex gap-2"><input name="skill" defaultValue={skill} placeholder="Skill, title or city (try dbt)" className="field w-64" /><button className="btn">Search</button></form>
      </PageHeader>
      {rows.length === 0 ? <Empty>No candidates match.</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => (
            <div key={p.id} className="card p-4 text-sm">
              <div className="font-semibold">{p.name}</div>
              <div className="muted text-xs">{p.title} at {p.currentEmployer}</div>
              <div className="muted text-xs">{p.location}</div>
              <div className="mt-2 flex flex-wrap gap-1">{p.skills?.split(", ").map((sk) => <Badge key={sk} tone={skill && sk.toLowerCase().includes(skill.toLowerCase()) ? "teal" : "gray"}>{sk}</Badge>)}</div>
            </div>
          ))}
        </div>
      )}
      <SampleNote />
    </>
  );
}
