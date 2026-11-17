import Link from "next/link";
import { TouchDots } from "@/components/history";
import { LinkedInActions } from "@/components/linkedin";
import { Badge, Empty, PageHeader, Stat, type Tone } from "@/components/ui";
import { channelLabel, listProgress, pace, type Progress, type Standing } from "@/core/history";

const GROUPS: [Standing, string, string, Tone][] = [
  ["answer", "They responded: your move", "Someone answered. Reply while it is fresh.", "green"],
  ["due", "Due for the next step", "Enough time has passed. Take the next step or let them go.", "amber"],
  ["waiting", "Waiting on them", "Nothing to do yet. The date is when the next step comes due.", "blue"],
  ["finished", "Finished for now", "Tried enough times, or the conversation reached an end.", "gray"],
];
const day = (d: Date | null) => (d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
const hrefFor = (p: Progress) => (p.type === "candidate" ? `/sourcing/candidates/${p.personId}` : p.companyId ? `/bd/accounts/${p.companyId}` : "/bd/people");

export default async function InProgress({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  const who = (await searchParams).who;
  const [all, p] = await Promise.all([listProgress({ days: 90 }), pace()]);
  const rows = all.filter((r) => (who === "candidates" ? r.type === "candidate" : who === "bd" ? r.type !== "candidate" : true));
  return (
    <>
      <PageHeader title="In progress" sub="Everyone you have already reached out to, and where each one stands. The app waits a set number of days on each channel, then tells you the next step, so nobody is contacted twice by accident or forgotten.">
        {[["", "Everyone"], ["bd", "Decision makers"], ["candidates", "Candidates"]].map(([v, n]) => <Link key={v} href={v ? `/bd/progress?who=${v}` : "/bd/progress"} className={`btn ${(who ?? "") === v ? "btn-primary" : ""}`}>{n}</Link>)}
      </PageHeader>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="LinkedIn requests this week" value={`${p.connects_week} of ${p.plan.weeklyLinkedInLimit}`} hint="LinkedIn limits how many you can send in a week" tone={p.connects_week >= p.plan.weeklyLinkedInLimit ? "warn" : undefined} />
        <Stat label="LinkedIn requests today" value={`${p.connects_today} of ${p.plan.dailyConnects}`} hint="Your daily plan" />
        <Stat label="Calls today" value={`${p.calls_today} of ${p.plan.dailyCalls}`} hint="Your daily plan" />
        <Stat label="Emails and texts today" value={`${p.messages_today} of ${p.plan.dailyFollowUps}`} hint="Your daily plan" />
      </div>
      {rows.length === 0 && <Empty>Nobody has been contacted yet. As you connect, email and call, people appear here.</Empty>}
      {GROUPS.map(([standing, title, help, tone]) => {
        const group = rows.filter((r) => r.standing === standing);
        if (group.length === 0) return null;
        return (
          <section key={standing} className="mb-6">
            <div className="mb-2 flex items-baseline gap-2"><h2 className="text-sm font-semibold">{title}</h2><Badge tone={tone}>{group.length}</Badge><span className="muted text-xs">{help}</span></div>
            <div className="card overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Person</th><th>What has happened</th><th>Last contact</th><th>Next step</th><th /></tr></thead>
                <tbody>
                  {group.slice(0, 60).map((r) => (
                    <tr key={r.personId}>
                      <td><Link href={hrefFor(r)} className="font-medium text-brand hover:underline">{r.name}</Link><div className="muted max-w-56 truncate text-xs">{r.type === "candidate" ? "Candidate" : r.company}{r.title && ` · ${r.title}`}</div></td>
                      <td><TouchDots touches={r.touches} /><div className="muted text-xs">{r.contacts} contact{r.contacts === 1 ? "" : "s"} since {day(r.firstContactAt)}</div></td>
                      <td className="text-xs">{r.lastChannel && channelLabel(r.lastChannel)}<div className="muted">{day(r.lastContactAt)}{r.lastOutcome && ` · ${r.lastOutcome.replace(/_/g, " ")}`}</div></td>
                      <td className="max-w-64 text-xs">{r.next}{r.dueAt && standing !== "answer" && <div className="muted">{standing === "waiting" ? "Comes due" : "Since"} {day(r.dueAt)}</div>}</td>
                      <td className="text-right">{r.type !== "candidate" && r.lastChannel === "linkedin" && (standing === "due" || standing === "answer") ? <LinkedInActions person={{ id: r.personId, name: r.name, linkedinUrl: r.linkedinUrl, connectionStatus: r.connectionStatus, connectionNote: null }} compact /> : <Link href={hrefFor(r)} className={`btn ${standing === "due" || standing === "answer" ? "btn-primary" : ""}`}>{r.lastChannel === "call" && standing === "due" ? "Open to call" : "Open"}</Link>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {group.length > 60 && <p className="muted mt-2 text-xs">Showing 60 of {group.length}.</p>}
          </section>
        );
      })}
      <p className="muted max-w-3xl text-xs leading-relaxed">The waits: {7} days for a LinkedIn request to be accepted, 5 days for a reply to an email or message, 2 days before calling back. After 4 tries with no answer the person is finished for 30 days. Dots: <span className="text-sky-600">blue</span> LinkedIn, <span className="text-emerald-600">green</span> email or text, <span className="text-amber-600">amber</span> call, grey for something Claude prepared; a ring means they responded.</p>
    </>
  );
}
