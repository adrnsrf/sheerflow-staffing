import { signalTypeAction } from "@/app/actions";
import { Badge, PageHeader } from "@/components/ui";
import { listSignalTypes } from "@/core/signals";

export default async function Scoring({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const [types, q] = await Promise.all([listSignalTypes(), searchParams]);
  return (
    <>
      <PageHeader title="Signal scoring" sub="Every reason to reach out is a signal. Each kind is worth some points when it is fresh and fades with age. A company's priority is its signals added up, and your to-do list is ranked by it. Change the numbers to change what rises to the top." />
      {q.saved && <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">Saved &ldquo;{q.saved}&rdquo;. Priorities across the app now use the new numbers.</div>}
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Signal</th><th>About</th><th>What it means</th><th className="text-right">In the data now</th><th>Points when fresh</th><th>Days until worth half</th><th /></tr></thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.type}>
                <td className="font-medium whitespace-nowrap">{t.label}</td>
                <td><Badge tone={t.level === "person" ? "teal" : "blue"}>{t.level === "person" ? "A person" : "A company"}</Badge></td>
                <td className="muted max-w-sm text-xs">{t.description}</td>
                <td className="text-right tabular-nums">{t.count}<div className="muted text-xs">{t.points} pts</div></td>
                <td colSpan={3}>
                  <form action={signalTypeAction} className="flex items-center gap-2">
                    <input type="hidden" name="type" value={t.type} /><input type="hidden" name="label" value={t.label} />
                    <input name="weight" type="number" min={0} max={100} defaultValue={t.weight} className="field w-20 py-1" />
                    <input name="halfLifeDays" type="number" min={1} max={730} defaultValue={t.halfLifeDays} className="field ml-8 w-20 py-1" />
                    <button className="btn ml-2">Save</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="muted mt-6 max-w-3xl space-y-2 text-xs leading-relaxed">
        <p><span className="font-medium text-stone-700">Example.</span> A LinkedIn post about hiring is worth 30 points the day it goes up and 15 points two weeks later. Someone picking up the phone is worth more than anything you only observed.</p>
        <p><span className="font-medium text-stone-700">Two limits.</span> One kind of signal can never count for more than one and a half times its points for a company, so ten job postings do not drown out a conversation. How well a company fits (small recruiting team, 51 to 500 people, has a data team) adds up to 30 points, but fit alone never puts a company on your to-do list.</p>
      </div>
    </>
  );
}
