import Link from "next/link";
import { saveRoleAction } from "@/app/actions";
import { MatchScore, MatchWhy, ToolFit } from "@/components/candidate";
import { Badge, PageHeader } from "@/components/ui";
import { SIZE_LABEL } from "@/core/candidate-schema";
import { matchText } from "@/core/matching";
import { label } from "@/lib/format";

export default async function TryMatch({ searchParams }: { searchParams: Promise<{ text?: string }> }) {
  const text = (await searchParams).text?.trim();
  const result = text ? await matchText(text, 10) : null;
  const req = result?.requirements;
  return (
    <>
      <PageHeader title="Try a job description" sub="Paste any job description to see who fits, without saving anything. The app reads the tools, years, company size, location and pay from the text, then ranks every candidate." />
      <form className="card space-y-2 p-4">
        <textarea name="text" defaultValue={text} required rows={8} placeholder="Paste a job description here" className="field w-full text-[13px]" />
        <button className="btn btn-primary px-4">Find matches</button>
      </form>
      {result && req && (
        <>
          <div className="card mt-4 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">What the app read from it</h2>
              <form action={saveRoleAction} className="flex items-center gap-2">
                <input type="hidden" name="description" value={text} /><input type="hidden" name="requirements" value={JSON.stringify(req)} />
                <input name="title" required placeholder="Role title" className="field py-1 text-xs" /><input name="clientName" placeholder="Client" className="field py-1 text-xs" />
                <button className="btn">Save as a role</button>
              </form>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">{req.tools.map((t) => <Badge key={t.name} tone={t.must ? "teal" : "gray"}>{t.name} {t.minYears}+ yrs{!t.must && " (nice)"}</Badge>)}{req.tools.length === 0 && <span className="muted">No known tools found.</span>}</div>
            <div className="muted mt-2 text-xs">{[req.minTotalYears && `${req.minTotalYears}+ years overall`, req.companySize && SIZE_LABEL[req.companySize], req.workplace && label(req.workplace), [req.city, req.state].filter(Boolean).join(", "), req.maxBase && `up to $${Math.round(req.maxBase / 1000)}k`].filter(Boolean).join(" · ") || "Nothing else stated."}</div>
          </div>
          <div className="mt-4 space-y-2">
            {result.matches.map((m) => (
              <div key={m.personId} className="card flex items-start gap-4 p-4">
                <MatchScore m={m} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2"><Link href={`/sourcing/candidates/${m.personId}`} className="font-semibold text-brand hover:underline">{m.name}</Link><span className="muted text-sm">{m.headline}</span></div>
                  <div className="mt-1.5"><ToolFit tools={m.tools} /></div>
                  <MatchWhy m={m} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
