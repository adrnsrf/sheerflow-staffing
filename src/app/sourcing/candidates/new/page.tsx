import Link from "next/link";
import { createCandidateAction } from "@/app/actions";
import { PageHeader } from "@/components/ui";
import { SOURCES, SOURCE_LABEL } from "@/core/candidate-schema";

export default async function NewCandidate({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const error = (await searchParams).error;
  return (
    <>
      <div className="muted mb-2 text-xs"><Link href="/sourcing/candidates" className="hover:underline">Candidates</Link> / New</div>
      <PageHeader title="Add a candidate" sub="Give a name and paste whatever you have. It is kept exactly as pasted, and a Claude run turns it into the structured profile." />
      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      <form action={createCandidateAction} className="card max-w-3xl space-y-3 p-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <label><span className="muted mb-1 block text-xs font-medium">Name</span><input name="name" required className="field w-full" /></label>
          <label><span className="muted mb-1 block text-xs font-medium">LinkedIn URL (used to avoid duplicates)</span><input name="linkedinUrl" placeholder="https://www.linkedin.com/in/..." className="field w-full" /></label>
          <label><span className="muted mb-1 block text-xs font-medium">Email</span><input name="email" type="email" className="field w-full" /></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label><span className="muted mb-1 block text-xs font-medium">What are you pasting?</span>
            <select name="kind" className="field w-full">{SOURCES.map((k) => <option key={k} value={k}>{SOURCE_LABEL[k]}</option>)}</select>
          </label>
          <label className="sm:col-span-2"><span className="muted mb-1 block text-xs font-medium">Label (optional)</span><input name="title" placeholder="e.g. Resume from application, Nov 2026" className="field w-full" /></label>
        </div>
        <label className="block"><span className="muted mb-1 block text-xs font-medium">Paste it here (profile text, resume, application answers, call transcript, messages)</span>
          <textarea name="content" rows={14} className="field w-full text-[13px]" />
        </label>
        <button className="btn btn-primary px-4 py-1.5 text-sm">Add candidate</button>
      </form>
    </>
  );
}
