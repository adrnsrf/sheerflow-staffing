import Link from "next/link";
import { saveRoleAction } from "@/app/actions";
import { Badge, PageHeader } from "@/components/ui";
import { listSearches } from "@/core";
import { candidatesReady } from "@/core/candidates";
import { SIZE_LABEL } from "@/core/candidate-schema";
import { label, rel } from "@/lib/format";

const FUNNEL = ["sourced", "contacted", "screened", "submitted", "interview", "offer", "placed"] as const;

export default async function Roles({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await candidatesReady();
  const [rows, q] = await Promise.all([listSearches(), searchParams]);
  return (
    <>
      <PageHeader title="Roles" sub="Each open role holds its job description, what it requires, and a ranked list of matching candidates." />
      {q.error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{q.error}</div>}
      <div className="space-y-3">
        {rows.map(({ search, client, stages }) => (
          <Link key={search.id} href={`/sourcing/searches/${search.id}`} className="card block p-4 transition hover:border-brand">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><span className="font-semibold">{search.title}</span> <span className="muted">· {client}</span>{search.isSample && <> <Badge>Sample</Badge></>}</div>
              <div className="flex items-center gap-2"><span className="muted text-xs">Opened {rel(search.openedAt)}</span><Badge tone={search.status === "open" ? "green" : search.status === "filled" ? "blue" : "amber"}>{label(search.status)}</Badge></div>
            </div>
            <div className="muted mt-1 text-sm">{[search.compRange, search.requirements?.companySize && SIZE_LABEL[search.requirements.companySize], search.requirements?.workplace && label(search.requirements.workplace), search.mustHaves].filter(Boolean).join(" · ")}</div>
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
      <details className="card mt-6 p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Add a role</summary>
        <form action={saveRoleAction} className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="muted mb-1 block text-xs font-medium">Role title</span><input name="title" required className="field w-full" /></label>
            <label><span className="muted mb-1 block text-xs font-medium">Client</span><input name="clientName" className="field w-full" /></label>
          </div>
          <label className="block"><span className="muted mb-1 block text-xs font-medium">Job description (paste it whole; tools, years, company size, location and pay are read from it)</span><textarea name="description" required rows={10} className="field w-full text-[13px]" /></label>
          <button className="btn btn-primary">Add role and match candidates</button>
        </form>
      </details>
    </>
  );
}
