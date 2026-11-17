import Link from "next/link";
import { Badge, PageHeader, type Tone } from "@/components/ui";
import { getConnectors, getConnector } from "@/connectors";

// What each status means, in the owner's words.
const MODE: Record<string, [string, Tone, string]> = {
  live: ["Connected", "green", "The app talks to it directly."],
  sample: ["Not connected", "amber", "The app does not talk to it yet. Claude can still use its own connection to it during a run."],
  manual: ["By hand, on purpose", "blue", "The app opens it for you and you act there yourself."],
  via_claude: ["Through Claude", "violet", "Claude uses it during a run; the app never calls it."],
  later: ["Not built yet", "gray", "Planned."],
};

export default async function Connectors({ searchParams }: { searchParams: Promise<{ test?: string }> }) {
  const tested = getConnector((await searchParams).test ?? "");
  const result = tested?.test ? await tested.test() : null;
  const list = getConnectors();
  const live = list.filter((c) => c.mode === "live").length;
  return (
    <>
      <PageHeader title="Connections" sub={live === 0 ? "No outside tool is connected to the app directly yet. Until one is, Claude brings data in during its runs, and LinkedIn is always done by hand." : `${live} outside tool${live === 1 ? " is" : "s are"} connected to the app directly.`} />
      {tested && result && <div className="mb-4 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm"><span className="font-semibold">{tested.name} check:</span> {result.replace(/^Sample: /, "Not connected, so nothing was called. Example of what it would show: ")}</div>}
      <div className="space-y-2">
        {list.map((c) => (
          <div key={c.id} className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{c.name}</span><Badge tone={MODE[c.mode][1]}>{MODE[c.mode][0]}</Badge></div>
              <div className="muted">{c.usedFor}. {MODE[c.mode][2]}</div>
            </div>
            <div className="flex gap-1.5">{c.test && <Link href={`/system/connectors?test=${c.id}`} className="btn">Check</Link>}{c.href && <Link href={c.href} className="btn">Open</Link>}</div>
          </div>
        ))}
      </div>
      <details className="card mt-6 p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Setup (for whoever installs this)</summary>
        <p className="muted mt-2 text-xs">Each tool is switched on by putting its keys in a file named <code>.env.local</code> in the project folder and restarting the app. The keys stay on this computer.</p>
        <table className="mt-2 w-full text-xs"><tbody>{list.filter((c) => c.envVars.length).map((c) => <tr key={c.id}><td className="py-1 pr-4 font-medium">{c.name}</td><td className="font-mono text-stone-500">{c.envVars.join(", ")}</td></tr>)}</tbody></table>
      </details>
    </>
  );
}
