import { addStaffingAction, staffingStatusAction } from "@/app/actions";
import { Act, Badge, PageHeader, Stat } from "@/components/ui";
import { listStaffingFirms } from "@/core/staffing";
import { fmtDate } from "@/lib/format";

export default async function Staffing() {
  const firms = await listStaffingFirms();
  const by = (st: string) => firms.filter((f) => f.status === st);
  return (
    <>
      <PageHeader title="Staffing firms" sub="A running archive of staffing firms, recruiters and job boards. They are never prospects, so anything that arrives under one of these names (a job alert, a hiring post, a company import) is dropped and counted here.">
        <form action={addStaffingAction} className="flex gap-2">
          <input name="name" placeholder="Firm name" className="field w-48" required />
          <input name="note" placeholder="Why (optional)" className="field w-48" />
          <button className="btn btn-primary">Add firm</button>
        </form>
      </PageHeader>
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Confirmed" value={by("confirmed").length} />
        <Stat label="Suspected, to review" value={by("suspected").length} hint="Added because of the name" tone={by("suspected").length ? "warn" : undefined} />
        <Stat label="Items dropped so far" value={firms.filter((f) => f.status !== "not_staffing").reduce((n, f) => n + f.timesSeen, 0)} hint="Times a listed firm turned up" />
      </div>
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Firm</th><th>Status</th><th>Where it came from</th><th className="text-right">Times seen</th><th>Last seen</th><th /></tr></thead>
          <tbody>
            {[...by("suspected"), ...by("confirmed"), ...by("not_staffing")].map((f) => (
              <tr key={f.id}>
                <td><div className="font-medium">{f.name}</div>{f.note && <div className="muted max-w-md text-xs">{f.note}</div>}</td>
                <td><Badge tone={f.status === "confirmed" ? "red" : f.status === "suspected" ? "amber" : "green"}>{f.status === "not_staffing" ? "Not staffing" : f.status === "confirmed" ? "Confirmed" : "Suspected"}</Badge></td>
                <td className="muted">{f.source}</td>
                <td className="text-right tabular-nums">{f.timesSeen}</td>
                <td className="muted">{fmtDate(f.lastSeenAt)}</td>
                <td className="whitespace-nowrap text-right">
                  {f.status !== "confirmed" && <Act action={staffingStatusAction} fields={{ id: f.id, status: "confirmed" }}>Confirm</Act>}{" "}
                  {f.status !== "not_staffing" && <Act action={staffingStatusAction} fields={{ id: f.id, status: "not_staffing" }} title="A real employer. Stops dropping what arrives under this name.">Not staffing</Act>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted mt-6 max-w-3xl text-xs leading-relaxed">Marking a firm as not staffing lets its jobs and posts in from the next import onward; what was dropped earlier comes back when you run that import again. Claude checks names against this list with its own tool and adds firms it confirms.</p>
    </>
  );
}
