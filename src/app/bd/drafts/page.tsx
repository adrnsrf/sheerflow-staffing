import { draftStatusAction } from "@/app/actions";
import { CopyButton } from "@/components/client";
import { Act, Badge, PageHeader, SampleNote } from "@/components/ui";
import { listDrafts } from "@/core";
import { label } from "@/lib/format";

export default async function Drafts() {
  const rows = await listDrafts();
  return (
    <>
      <PageHeader title="Outreach drafts" sub="Cold emails and follow-ups written by Claude in your voice. Approve one and it goes to Gmail as a draft once Gmail is connected. Nothing sends until you press Send there." />
      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map(({ draft, person, company }) => (
          <div key={draft.id} className="card flex flex-col p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-sm"><span className="font-semibold">{person?.name}</span> <span className="muted">· {company?.name}</span></div>
              <div className="flex gap-1.5"><Badge tone="blue">{label(draft.kind)}</Badge><Badge tone={draft.status === "draft" ? "amber" : "green"}>{label(draft.status)}</Badge></div>
            </div>
            <div className="text-sm font-medium">{draft.subject}</div>
            <pre className="mt-2 flex-1 whitespace-pre-wrap rounded-md bg-stone-50 p-3 font-sans text-sm leading-relaxed text-stone-700">{draft.body}</pre>
            <div className="mt-3 flex gap-1.5">
              {draft.status === "draft" ? <Act action={draftStatusAction} fields={{ id: draft.id, status: "approved" }} className="btn btn-primary">Approve</Act> : <Act action={draftStatusAction} fields={{ id: draft.id, status: "draft" }}>Back to draft</Act>}
              <CopyButton text={`${draft.subject}\n\n${draft.body}`}>Copy</CopyButton>
            </div>
          </div>
        ))}
      </div>
      <SampleNote />
    </>
  );
}
