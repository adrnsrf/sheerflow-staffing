import { PageHeader, SampleNote, Stat } from "@/components/ui";
import { getCredits, getSetting } from "@/core";
import { fmtDate } from "@/lib/format";

export default async function Budgets() {
  const [c, claude] = await Promise.all([getCredits(), getSetting<{ resets: string }>("claude_usage")]);
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / c.budget.cycleCredits) * 100))}%`;
  return (
    <>
      <PageHeader title="Budgets" sub="Apollo credits for this cycle with the reserve held back, and your Claude usage reset." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Apollo credits left" value={c.balance.toLocaleString()} hint={`of ${c.budget.cycleCredits.toLocaleString()} this cycle`} />
        <Stat label="Reserve (never spent)" value={c.reserve.toLocaleString()} hint={`${c.budget.reservePct}% of the cycle`} />
        <Stat label="Free to spend" value={c.spendable.toLocaleString()} hint="Only on your approval" />
        <Stat label="Claude usage resets" value={<span className="text-lg">{claude?.resets}</span>} hint="Heavy runs are best right after" />
      </div>
      <div className="card mb-6 p-4">
        <div className="flex h-3 overflow-hidden rounded-full bg-stone-100">
          <div className="bg-stone-400" style={{ width: pct(c.spent) }} title="Spent" />
          <div className="bg-brand" style={{ width: pct(c.spendable) }} title="Free to spend" />
          <div className="bg-amber-400" style={{ width: pct(c.reserve) }} title="Reserve" />
        </div>
        <div className="muted mt-2 flex gap-4 text-xs"><span>■ Spent {c.spent}</span><span className="text-brand">■ Free {c.spendable}</span><span className="text-amber-600">■ Reserve {c.reserve}</span><span className="ml-auto">Resets {c.budget.cycleResets}</span></div>
      </div>
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Date</th><th>What the run spent it on</th><th className="text-right">Credits</th><th className="text-right">Balance after</th></tr></thead>
          <tbody>{c.ledger.map((l) => <tr key={l.id}><td className="muted">{fmtDate(l.createdAt)}</td><td>{l.reason}</td><td className="text-right tabular-nums">{l.delta}</td><td className="text-right tabular-nums">{l.balanceAfter.toLocaleString()}</td></tr>)}</tbody>
        </table>
      </div>
      <SampleNote />
    </>
  );
}
