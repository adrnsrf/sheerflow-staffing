import Link from "next/link";
import { notFound } from "next/navigation";
import { addToCallListAction, queueJobAction } from "@/app/actions";
import { LinkedInActions } from "@/components/linkedin";
import { Act, Badge, PageHeader, Tier } from "@/components/ui";
import { fee, getAccount } from "@/core";
import { fmtDate, label, money } from "@/lib/format";

export default async function Account({ params }: { params: Promise<{ id: string }> }) {
  const acct = await getAccount(Number((await params).id));
  if (!acct) notFound();
  const { company: c, people, signals, activities, queue, deals, searches } = acct;
  const dnc = c.status === "do_not_contact";
  return (
    <>
      <div className="muted mb-2 text-xs"><Link href="/bd/accounts" className="hover:underline">Accounts</Link> / {c.name}</div>
      <PageHeader title={c.name} sub={[c.industry, c.location, c.domain].filter(Boolean).join(" · ")}>
        <Tier tier={c.icpTier} score={c.icpScore} />
        {dnc && <Badge tone="red">Do not contact</Badge>}
        {queue ? <Link href="/bd/calls" className="btn">On call list: {label(queue.status)}</Link> : !dnc && <Act action={addToCallListAction} fields={{ companyId: c.id }} className="btn btn-primary">Add to call list</Act>}
        <Act action={queueJobAction} fields={{ kind: "company_brief", title: `Refresh the brief for ${c.name}`, payload: JSON.stringify({ companyId: c.id }) }} title="Queues a job for the next Claude run">Ask Claude to refresh brief</Act>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-4">
            <h2 className="mb-2 text-sm font-semibold">Brief</h2>
            <p className="text-sm leading-relaxed">{c.brief ?? "No brief yet."}</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              {[["Employees", c.employees], ["Headcount growth (6 mo)", c.headcountGrowth], ["Data team", c.dataTeamSize], ["Open data roles", c.openDataRoles], ["Recruiters", c.recruitingTeamSize], ["Technical recruiters", c.technicalRecruiters], ["Avg data salary", c.avgDataSalaryK ? `$${c.avgDataSalaryK}K` : null], ["HQ phone", c.hqPhone]].map(([k, v]) => (
                <div key={k as string}><dt className="muted text-xs">{k}</dt><dd className="font-medium">{v ?? "Unknown"}</dd></div>
              ))}
            </dl>
            {c.altPhones && <div className="mt-3 text-sm"><div className="muted text-xs">Alt company phones</div><div className="whitespace-pre-line">{c.altPhones}</div></div>}
            {c.keywords && <p className="muted mt-3 text-xs">Keywords: {c.keywords}</p>}
            {queue?.alternateDms && <div className="mt-3 text-sm"><div className="muted text-xs">Alternate decision makers (names masked until revealed)</div><div className="whitespace-pre-line">{queue.alternateDms}</div></div>}
          </section>
          <section className="card">
            <h2 className="border-b border-stone-200 px-4 py-3 text-sm font-semibold">Signals</h2>
            {signals.length === 0 && <p className="muted p-4 text-sm">None yet.</p>}
            {signals.map((sg) => (
              <div key={sg.id} className="flex items-start justify-between gap-3 border-b border-stone-100 px-4 py-2.5 text-sm last:border-b-0">
                <div><div>{sg.title}</div><div className="muted text-xs">{sg.source} · {fmtDate(sg.signalDate)}</div></div>
                <Badge tone={sg.status === "new" ? "teal" : "gray"}>{label(sg.status)}</Badge>
              </div>
            ))}
          </section>
          <section className="card">
            <h2 className="border-b border-stone-200 px-4 py-3 text-sm font-semibold">Past touches</h2>
            {activities.length === 0 && <p className="muted p-4 text-sm">No touches yet.</p>}
            {activities.map(({ a, user, person }) => (
              <div key={a.id} className="flex gap-3 border-b border-stone-100 px-4 py-2 text-sm last:border-b-0">
                <span className="muted w-20 shrink-0 text-xs">{fmtDate(a.occurredAt)}</span>
                <span className="w-16 shrink-0 font-medium">{label(a.type)}</span>
                <span className="flex-1">{label(a.outcome)}{person && <span className="muted"> · {person}</span>}{a.notes && <span className="muted"> · {a.notes}</span>}</span>
                <span className="muted text-xs">{user}</span>
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
                <div className="mt-1 text-xs">{p.contactRevealed ? <>{p.email}{p.phone && ` · ${p.phone}`}</> : <span className="muted">Contact not revealed (costs Apollo credits)</span>}</div>
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
