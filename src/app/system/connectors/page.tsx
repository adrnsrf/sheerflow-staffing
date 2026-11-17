import Link from "next/link";
import { Badge, PageHeader, type Tone } from "@/components/ui";
import { getConnectors, getConnector } from "@/connectors";

const MODE: Record<string, [string, Tone]> = { live: ["Live", "green"], sample: ["Sample data", "amber"], manual: ["Manual by design", "blue"], via_claude: ["Runs through Claude", "violet"], later: ["Not built yet", "gray"] };

export default async function Connectors({ searchParams }: { searchParams: Promise<{ test?: string }> }) {
  const tested = getConnector((await searchParams).test ?? "");
  const result = tested?.test ? await tested.test() : null;
  return (
    <>
      <PageHeader title="Connections" sub="Every outside tool the platform plugs into. Apollo goes live when its key is set. The rest return sample data so the flow can be tried end to end." />
      {tested && result && <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900"><span className="font-semibold">{tested.name}:</span> {result}</div>}
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Tool</th><th>How</th><th>Used for</th><th>Status</th><th>Goes live with</th><th /></tr></thead>
          <tbody>
            {getConnectors().map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td><td className="muted">{c.how}</td><td>{c.usedFor}</td>
                <td><Badge tone={MODE[c.mode][1]}>{MODE[c.mode][0]}</Badge></td>
                <td className="font-mono text-[11px] text-stone-500">{c.envVars.join(", ")}</td>
                <td className="whitespace-nowrap">{c.test && <Link href={`/system/connectors?test=${c.id}`} className="btn">Test</Link>} {c.href && <Link href={c.href} className="btn">Open</Link>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
