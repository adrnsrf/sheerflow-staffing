import Link from "next/link";
import { notFound } from "next/navigation";
import { addToCallListAction, queueJobAction } from "@/app/actions";
import { LinkedInActions } from "@/components/linkedin";
import { Act, Badge, PageHeader, Tier } from "@/components/ui";
import { fee, getAccount } from "@/core";
import { companyHeat, companySignals } from "@/core/signals";
import { fmtDate, label, money } from "@/lib/format";

export default async function Account({ params }: { params: Promise<{ id: string }> }) {
  const acct = await getAccount(Number((await params).id));
  if (!acct) notFound();
  const { company: c, people, timeline, queue, deals, searches, phones } = acct;
  const [facts, heat] = await Promise.all([companySignals(c.id), companyHeat(c.id)]);
  const dnc = c.status === "do_not_contact";
  return (
    <>
      <div className="muted mb-2 text-xs"><Link href="/bd/accounts" className="hover:underline">Accounts</Link> / {c.name}</div>
      <PageHeader title={c.name} sub={[c.industry, c.location, c.domain].filter(Boolean).join(" · ")}>
        <Tier tier={c.icpTier} score={c.icpScore} />
        {dnc && <Badge tone="red">Do not contact</Badge>}
        {queue ? <Link href="/bd/calls" className="btn">On call list: {label(queue.status === "new" ? "not_started" : queue.status)}</Link> : !dnc && <Act action={addToCallListAction} fields={{ companyId: c.id }} className="btn btn-primary">Add to call list</Act>}
        <Act action={queueJobAction} fields={{ kind: "company_brief", title: `Refresh the brief for ${c.name}`, payload: JSON.stringify({ companyId: c.id }) }} title="Queues a job for the next Claude run">Ask Claude to refresh brief</Act>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-4">
            <h2 className="mb-2 text-sm font-semibold">Brief</h2>
            <p className="text-sm leading-relaxed">{c.brief ?? "No brief yet."}</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              {[["Employees", c.employees], ["Headcount growth (6 mo)", c.headcountGrowth], ["Data team", c.dataTeamSize], ["Open data roles", c.openDataRoles], ["Recruiters", c.recruitingTeamSize], ["Technical recruiters", c.technicalRecruiters], ["Avg data salary", c.avgDataSalaryK ? `$${c.avgDataSalaryK}K` : null]].map(([k, v]) => (
                <div key={k as string}><dt className="muted text-xs">{k}</dt><dd className="font-medium">{v ?? "Unknown"}</dd></div>
              ))}
            </dl>
            {c.keywords && <p className="muted mt-3 text-xs">Keywords: {c.keywords}</p>}
            {queue?.alternateDms && <div className="mt-3 text-sm"><div className="muted text-xs">Alternate decision makers (names masked until revealed)</div><div className="whitespace-pre-line">{queue.alternateDms}</div></div>}
          </section>
          <section className="card">
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
              <h2 className="text-sm font-semibold">Why now</h2>
              {heat && <span className="text-xs"><span className="font-semibold tabular-nums">Priority {Math.round(heat.priority)}</span><span className="muted"> = heat {Math.round(heat.heat)} + fit {Math.round(heat.fit)}</span></span>}
            </div>
            {facts.length === 0 && <p className="muted p-4 text-sm">No signals yet.</p>}
            {facts.map((f) => (
              <div key={f.signal_id} className="flex items-start gap-3 border-b border-stone-100 px-4 py-2.5 text-sm last:border-b-0">
                <span className="w-10 shrink-0 text-right font-semibold tabular-nums text-brand" title={`${f.weight} points when fresh, halves every ${f.half_life_days} days`}>{f.score.toFixed(0)}</span>
                <div className="min-w-0 flex-1">
                  <div>{f.url ? <a href={f.url} target="_blank" rel="noreferrer" className="hover:underline">{f.title}</a> : f.title}</div>
                  <div className="muted text-xs">{f.type_label} · {f.source} · {fmtDate(f.occurred_at)}{f.detail && ` · ${f.detail.slice(0, 140)}`}</div>
                </div>
                <Badge tone={f.level === "person" ? "teal" : "blue"}>{f.level === "person" ? "Person" : "Company"}</Badge>
              </div>
            ))}
          </section>
          <section className="card overflow-x-auto">
            <h2 className="border-b border-stone-200 px-4 py-3 text-sm font-semibold">Phone numbers</h2>
            {phones.length === 0 ? <p className="muted p-4 text-sm">None on file.</p> : (
              <table className="tbl">
                <thead><tr><th>Number</th><th>Whose</th><th>Source</th><th>Status</th><th className="text-right">Dials</th><th className="text-right">Bad</th><th className="text-right">Gatekeeper</th><th className="text-right">Reached</th></tr></thead>
                <tbody>
                  {phones.map((p) => (
                    <tr key={p.id}>
                      <td className={`font-medium tabular-nums whitespace-nowrap ${p.status === "bad" ? "line-through opacity-60" : ""}`}>{p.number}</td>
                      <td className="text-xs">{p.personId ? people.find((x) => x.id === p.personId)?.name ?? "Contact" : p.label ?? label(p.kind)}<div className="muted">{label(p.kind)}</div></td>
                      <td className="text-xs">{label(p.source)}{p.sourceDetail && <div className="muted">{p.sourceDetail}</div>}</td>
                      <td><Badge tone={p.status === "good" ? "green" : p.status === "unverified" ? "gray" : "red"}>{label(p.status)}</Badge></td>
                      <td className="text-right tabular-nums">{p.dials}</td><td className="text-right tabular-nums">{p.bad}</td><td className="text-right tabular-nums">{p.gatekeeper}</td><td className="text-right tabular-nums">{p.reached}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <section className="card">
            <h2 className="border-b border-stone-200 px-4 py-3 text-sm font-semibold">Call log and other touches</h2>
            {timeline.length === 0 && <p className="muted p-4 text-sm">No touches yet.</p>}
            {timeline.map((e) => (
              <div key={e.key} className="flex gap-3 border-b border-stone-100 px-4 py-2 text-sm last:border-b-0">
                <span className="muted w-14 shrink-0 text-xs">{fmtDate(e.at)}</span>
                <span className="w-16 shrink-0 font-medium">{label(e.type)}</span>
                <span className="min-w-0 flex-1"><span className="font-medium">{label(e.outcome)}</span>{e.number && <span className="muted tabular-nums"> · {e.number}</span>}{e.person && <span className="muted"> · {e.person}</span>}{e.notes && <span className="muted block text-xs">{e.notes}</span>}</span>
                <span className="muted shrink-0 text-xs">{e.user}</span>
              </div>
            ))}
          </section>
        </div>
        <div className="space-y-6">
          <section className="card">
            <h2 className="border-b border-stone-200 px-4 py-3 text-sm font-semibold">People</h2>
            {people.map((p) => (
              <div key={p.id} className="border-b border-stone-100 px-4 py-3 text-sm last:border-b-0">
                <div className="font-medium">{p.name}</div>
                <div className="muted text-xs">{p.title}</div>
                <div className="mt-1 text-xs">{p.contactRevealed ? [p.email, p.phone].filter(Boolean).join(" · ") : <span className="muted">Contact not revealed (costs Apollo credits)</span>}</div>
                <div className="mt-2">{dnc ? <span className="muted text-xs">Do not contact</span> : <LinkedInActions person={p} compact />}</div>
              </div>
            ))}
          </section>
          <section className="card p-4 text-sm">
            <h2 className="mb-2 text-sm font-semibold">Deals and searches</h2>
            {deals.length + searches.length === 0 && <p className="muted">Nothing open.</p>}
            {deals.map((d) => <div key={d.id} className="flex justify-between py-1"><span>{d.roleTitle} <span className="muted">· {label(d.stage)}</span></span><span className="tabular-nums">{money(fee(d.estSalary, d.feePct))}</span></div>)}
            {searches.map((sr) => <div key={sr.id} className="py-1"><Link href={`/sourcing/searches/${sr.id}`} className="text-brand hover:underline">Search: {sr.title}</Link> <span className="muted">· {label(sr.status)}</span></div>)}
          </section>
        </div>
      </div>
    </>
  );
}
