import Link from "next/link";
import { jobPostingAction } from "@/app/actions";
import { Act, Badge, Empty, PageHeader } from "@/components/ui";
import { listJobPostings } from "@/core/imports";
import type { JobPostingStatus } from "@/db/schema";
import { label, rel } from "@/lib/format";

const TABS: JobPostingStatus[] = ["new", "kept", "dismissed"];

export default async function Jobs({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status = TABS.find((t) => t === sp.status) ?? "new";
  const rows = await listJobPostings({ status });
  return (
    <>
      <PageHeader title="Job alerts" sub="Jobs pulled from LinkedIn job alert emails. A posting shows a company is hiring data people now. Jobs from staffing firms and job boards are dropped on the way in.">
        <Link href="/bd/staffing" className="btn">Staffing firms</Link>
      </PageHeader>
      <div className="mb-4 flex gap-1">
        {TABS.map((t) => <Link key={t} href={`/bd/jobs?status=${t}`} className={`rounded-md px-3 py-1.5 text-sm ${t === status ? "bg-ink font-medium text-white" : "text-stone-600 hover:bg-stone-200"}`}>{label(t)}</Link>)}
      </div>
      {rows.length === 0 ? <Empty>No jobs here. Run the job alerts routine, or import from the Import screen.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Role</th><th>Company</th><th>Location</th><th>Seen</th><th /></tr></thead>
            <tbody>
              {rows.map(({ job, company }) => (
                <tr key={job.id}>
                  <td><a href={job.url ?? "#"} target="_blank" rel="noreferrer" className="font-medium hover:underline">{job.title}</a>{job.salary && <div className="muted text-xs">{job.salary}</div>}</td>
                  <td>
                    {company ? <Link href={`/bd/accounts/${company.id}`} className="text-brand hover:underline">{job.companyName}</Link> : job.companyName}{" "}
                    {company && <Badge tone="green">Existing account</Badge>}
                  </td>
                  <td className="muted">{job.location}{job.workplace && ` · ${job.workplace}`}</td>
                  <td className="muted whitespace-nowrap text-xs">{rel(job.receivedAt)}<div>{job.alertKind}</div></td>
                  <td className="whitespace-nowrap text-right">
                    {status !== "kept" && <Act action={jobPostingAction} fields={{ id: job.id, status: "promote" }} className="btn btn-primary" title="Adds the company if it is new and puts this posting in New leads">Add to leads</Act>}{" "}
                    {status !== "dismissed" && <Act action={jobPostingAction} fields={{ id: job.id, status: "dismissed" }} className="btn btn-danger">Dismiss</Act>}
                    {status === "dismissed" && <Act action={jobPostingAction} fields={{ id: job.id, status: "new" }}>Restore</Act>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
