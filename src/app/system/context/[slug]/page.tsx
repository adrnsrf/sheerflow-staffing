import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteContextAction, resetContextAction, saveContextAction } from "@/app/actions";
import { Act, Badge, PageHeader } from "@/components/ui";
import { getContext } from "@/core/context";

export default async function ContextDoc({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { slug } = await params;
  const isNew = slug === "new";
  const doc = isNew ? null : await getContext(slug);
  if (!isNew && !doc) notFound();
  const saved = (await searchParams).saved;
  return (
    <>
      <div className="muted mb-2 text-xs"><Link href="/system/context" className="hover:underline">Claude&apos;s instructions</Link> / {doc?.title ?? "New"}</div>
      <PageHeader title={doc?.title ?? "New guide or routine"} sub={doc?.basedOn ? `Based on: ${doc.basedOn}` : undefined}>
        {doc && (doc.edited ? <Badge tone="violet">{doc.shipped ? "Edited by you" : "Written by you"}</Badge> : <Badge>Original</Badge>)}
        {doc?.shipped && doc.edited && <Act action={resetContextAction} fields={{ slug }} title="Discard your edits and go back to the text that came with the app">Put back the original</Act>}
        {doc && !doc.shipped && <Act action={deleteContextAction} fields={{ slug }} className="btn btn-danger">Delete</Act>}
      </PageHeader>
      {saved && <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">{saved === "reset" ? "Back to the original text." : "Saved. Claude will read this version from now on."}</div>}
      {/* Keyed on the saved version so the fields refresh after a save or reset. */}
      <form key={doc?.updatedAt.toISOString() ?? "new"} action={saveContextAction} className="card space-y-3 p-4 text-sm">
        {!isNew && <input type="hidden" name="slug" value={slug} />}
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="sm:col-span-2"><span className="muted mb-1 block text-xs font-medium">Title</span><input name="title" defaultValue={doc?.title} required className="field w-full" /></label>
          <label><span className="muted mb-1 block text-xs font-medium">Kind</span>
            <select name="kind" defaultValue={doc?.kind ?? "skill"} className="field w-full"><option value="skill">Guide (how to do something)</option><option value="routine">Routine (a job Claude can run)</option></select>
          </label>
          <label><span className="muted mb-1 block text-xs font-medium">Schedule (routines)</span><input name="schedule" defaultValue={doc?.schedule ?? ""} placeholder="e.g. Sundays" className="field w-full" /></label>
        </div>
        <label className="block"><span className="muted mb-1 block text-xs font-medium">One-line summary (Claude sees this in the list and decides whether to read the rest)</span><input name="summary" defaultValue={doc?.summary ?? ""} className="field w-full" /></label>
        <label className="block"><span className="muted mb-1 block text-xs font-medium">Instructions</span>
          <textarea name="body" defaultValue={doc?.body} required rows={26} className="field w-full font-mono text-[13px] leading-relaxed" placeholder="Write to Claude as you would brief a new hire: the goal, the rules, the steps, and what to report at the end." />
        </label>
        <div className="flex items-center gap-3"><button className="btn btn-primary px-4 py-1.5 text-sm">Save</button><span className="muted text-xs">Saved text is kept even when the app is updated.</span></div>
      </form>
    </>
  );
}
