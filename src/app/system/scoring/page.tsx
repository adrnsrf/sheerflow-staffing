import { signalTypeAction } from "@/app/actions";
import { Badge, PageHeader } from "@/components/ui";
import { listSignalTypes } from "@/core/signals";

export default async function Scoring() {
  const types = await listSignalTypes();
  return (
    <>
      <PageHeader title="Signal scoring" sub="Every reason to reach out is a signal. A fresh signal is worth its weight in points and loses half its value every half-life. A company's heat is its signals added up; Next actions ranks on that." />
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Signal</th><th>About</th><th>What it means</th><th className="text-right">In the data now</th><th>Weight (points)</th><th>Half-life (days)</th><th /></tr></thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.type}>
                <td className="font-medium whitespace-nowrap">{t.label}</td>
                <td><Badge tone={t.level === "person" ? "teal" : "blue"}>{t.level === "person" ? "A person" : "A company"}</Badge></td>
                <td className="muted max-w-sm text-xs">{t.description}</td>
                <td className="text-right tabular-nums">{t.count}<div className="muted text-xs">{t.points} pts</div></td>
                <td colSpan={3}>
                  <form action={signalTypeAction} className="flex items-center gap-2">
                    <input type="hidden" name="type" value={t.type} />
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
        <p><span className="font-medium text-stone-700">Where signals come from.</span> Each source has its own table: LinkedIn posts (person), job postings from LinkedIn alerts and Apollo (company), Apollo buying intent (company), company and contact research (open roles, new in role), and what your own outreach tells you (picked up, asked for an email, accepted, replied). One view per source puts them in the same shape, and <code>signals_fact</code> is all of them together.</p>
        <p><span className="font-medium text-stone-700">Guard rails.</span> No signal type can contribute more than one and a half times its weight to a company, so ten job postings do not drown out a conversation. Fit (thin recruiting team, 51 to 500 people, a data team) adds up to 30 points to priority but is never enough to act on without a signal.</p>
      </div>
    </>
  );
}
