import Link from "next/link";
import { addTaskAction, taskDoneAction } from "@/app/actions";
import { Act, Badge, PageHeader, SampleNote, Stat } from "@/components/ui";
import { getKpis, getOverview, listSignals, listTasks, listUsers } from "@/core";
import { isDue, rel } from "@/lib/format";

export default async function Today() {
  const [o, tasks, signals, [week], users] = await Promise.all([getOverview(), listTasks({ openOnly: true }), listSignals({ status: "new", limit: 5 }), getKpis({ weeks: 1 }), listUsers()]);
  return (
    <>
      <PageHeader title="Today" sub="What's hot and what's next, across business development, sourcing and the business." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="New signals" value={o.newSignals} hint="Hiring posts, job postings, new leaders" href="/bd/signals" />
        <Stat label="Calls due" value={o.callsDue} hint="Next step is today or earlier" href="/bd/calls" />
        <Stat label="Connection notes ready" value={o.readyToSend} hint={`${o.notesWaiting} more waiting on Claude`} href="/bd/connections" />
        <Stat label="Apollo credits you can spend" value={o.apolloCreditsSpendable.toLocaleString()} hint={`${o.apolloCreditsBalance.toLocaleString()} left, reserve kept back`} href="/manage/budgets" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card">
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
            <h2 className="text-sm font-semibold">Tasks</h2><span className="muted text-xs">{o.openTasks} open</span>
          </div>
          <ul>
            {tasks.map(({ task, owner, company }) => (
              <li key={task.id} className="flex items-center gap-3 border-b border-stone-100 px-4 py-2.5 text-sm">
                <Act action={taskDoneAction} fields={{ id: task.id, done: "true" }} className="h-4 w-4 cursor-pointer rounded border border-stone-400 hover:border-brand hover:bg-teal-50" title="Mark done">{""}</Act>
                <div className="min-w-0 flex-1">
                  <div className="truncate">{task.title}</div>
                  <div className="muted text-xs">{owner?.name}{company && <> · <Link className="hover:underline" href={`/bd/accounts/${company.id}`}>{company.name}</Link></>}</div>
                </div>
                {task.dueDate && <Badge tone={isDue(task.dueDate) ? "amber" : "gray"}>{rel(task.dueDate)}</Badge>}
              </li>
            ))}
          </ul>
          <form action={addTaskAction} className="flex gap-2 p-3">
            <input name="title" placeholder="Add a task" className="field flex-1" required />
            <select name="ownerId" className="field">{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            <button className="btn btn-primary">Add</button>
          </form>
        </section>
        <div className="space-y-6">
          <section className="card">
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
              <h2 className="text-sm font-semibold">Hottest new signals</h2><Link href="/bd/signals" className="text-xs font-medium text-brand hover:underline">Open inbox</Link>
            </div>
            <ul>
              {signals.map(({ signal, company }) => (
                <li key={signal.id} className="border-b border-stone-100 px-4 py-2.5 text-sm last:border-b-0">
                  <div className="truncate">{signal.title}</div>
                  <div className="muted text-xs">{company?.name} · Tier {company?.icpTier ?? "?"} · {rel(signal.signalDate)}</div>
                </li>
              ))}
            </ul>
          </section>
          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Last 7 days</h2><Link href="/manage/kpis" className="text-xs font-medium text-brand hover:underline">Weekly review</Link></div>
            <div className="grid grid-cols-4 gap-3 text-center">
              {[["Dials", week.dials], ["Connects", week.connects], ["Meetings booked", week.meetingsBooked], ["Queued for Claude", o.jobsQueued]].map(([k, v]) => (
                <div key={k}><div className="text-xl font-semibold tabular-nums">{v}</div><div className="muted text-xs">{k}</div></div>
              ))}
            </div>
          </section>
        </div>
      </div>
      <SampleNote />
    </>
  );
}
