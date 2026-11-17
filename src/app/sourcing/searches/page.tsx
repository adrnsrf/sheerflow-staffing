import Link from "next/link";
import { Badge, PageHeader, SampleNote } from "@/components/ui";
import { listSearches } from "@/core";
import { label, rel } from "@/lib/format";

const FUNNEL = ["sourced", "contacted", "screened", "submitted", "interview", "offer", "placed"] as const;

export default async function Searches() {
  const rows = await listSearches();
  return (
    <>
      <PageHeader title="Searches" sub="One search per open role, starting from the job intake brief." />
      <div className="space-y-3">
        {rows.map(({ search, company, stages }) => (
          <Link key={search.id} href={`/sourcing/searches/${search.id}`} className="card block p-4 transition hover:border-brand">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><span className="font-semibold">{search.title}</span> <span className="muted">at {company.name}</span></div>
              <div className="flex items-center gap-2"><span className="muted text-xs">Opened {rel(search.openedAt)}</span><Badge tone={search.status === "open" ? "green" : search.status === "filled" ? "blue" : "amber"}>{label(search.status)}</Badge></div>
            </div>
            <div className="muted mt-1 text-sm">{search.compRange} · {search.stack}</div>
            <div className="mt-3 grid grid-cols-7 gap-1.5">
              {FUNNEL.map((st) => (
                <div key={st} className={`rounded-md px-2 py-1.5 text-center ${stages[st] ? "bg-teal-50" : "bg-stone-50"}`}>
                  <div className={`text-base font-semibold tabular-nums ${stages[st] ? "text-brand" : "text-stone-300"}`}>{stages[st] ?? 0}</div>
                  <div className="muted text-[10px]">{label(st)}</div>
                </div>
              ))}
            </div>
          </Link>
        ))}
      </div>
      <SampleNote />
    </>
  );
}
