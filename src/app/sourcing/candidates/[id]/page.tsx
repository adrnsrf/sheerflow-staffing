import Link from "next/link";
import { notFound } from "next/navigation";
import { addSourceAction, compileCandidateAction, consentAction, refreshScreenCallAction, savePersonalityAction, saveProfileAction } from "@/app/actions";
import { CandidateOutreach } from "@/components/outreach";
import { retellConfigured } from "@/connectors/retell";
import { outreachFor } from "@/core/candidate-actions";
import { listScreenCalls } from "@/core/outreach";
import { PersonalityScales } from "@/components/candidate";
import { Act, Badge, PageHeader } from "@/components/ui";
import { DIMENSIONS, SIZE_LABEL, SOURCES, SOURCE_LABEL, describeDimension, personalityOf } from "@/core/candidate-schema";
import { getCandidate } from "@/core/candidates";
import { rolesForCandidate } from "@/core/matching";
import { fmtDate, label } from "@/lib/format";

const k = (n?: number) => (n ? `$${Math.round(n / 1000)}k` : "Unknown");

export default async function Candidate({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string; role?: string }> }) {
  const id = Number((await params).id);
  const c = await getCandidate(id);
  if (!c) notFound();
  const { person, profile: p, sources, check } = c;
  const [roles, q, calls] = await Promise.all([rolesForCandidate(id), searchParams, listScreenCalls(id)]);
  // Outreach is about a role: the one asked for in the link, else their best fit.
  const roleId = Number(q.role) || roles.find((r) => r.missingMust.length === 0)?.searchId || roles[0]?.searchId;
  const reach = roleId ? await outreachFor(id, roleId) : null;
  const uncompiled = sources.filter((s) => !s.compiledAt).length;
  const pers = personalityOf(p), known = Object.keys(pers.dimensions).length;
  return (
    <>
      <div className="muted mb-2 text-xs"><Link href="/sourcing/candidates" className="hover:underline">Candidates</Link> / {person.name}</div>
      <PageHeader title={person.name} sub={[p.headline, p.totalYears ? `${p.totalYears} years` : null, [p.location.city, p.location.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}>
        {c.isSample && <Badge>Sample</Badge>}
        <Badge tone={check.score >= 80 ? "green" : check.score >= 50 ? "amber" : "red"}>{check.score}% known</Badge>
        {person.linkedinUrl && <a href={person.linkedinUrl} target="_blank" rel="noreferrer" className="btn">LinkedIn</a>}
      </PageHeader>
      {q.error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{q.error}</div>}
      {q.saved && <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">{q.saved === "source" ? "Saved, and a job is queued for Claude to work it into the profile." : q.saved === "personality" ? "Personality saved. Matches that care about style now use it." : q.saved === "consent" ? "Consent updated." : "Profile saved. Search and matching now use this version."}</div>}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {p.summary && <section className="card p-4 text-sm leading-relaxed">{p.summary}</section>}
          <section className="card overflow-x-auto">
            <h2 className="border-b border-stone-200 px-4 py-3 text-sm font-semibold">Tools and years</h2>
            {p.skills.length === 0 ? <p className="muted p-4 text-sm">Not known yet.</p> : (
              <table className="tbl">
                <thead><tr><th>Tool</th><th className="text-right">Years</th><th>Level</th><th>Last used</th><th>How we know</th></tr></thead>
                <tbody>{[...p.skills].sort((a, b) => b.years - a.years).map((sk) => (
                  <tr key={sk.name}><td className="font-medium">{sk.name}</td><td className="text-right tabular-nums">{sk.years}</td><td className="muted">{label(sk.level)}</td><td className="muted tabular-nums">{sk.lastUsedYear}</td>
                    <td className="text-xs">{sk.source ? SOURCE_LABEL[sk.source] : "Unknown"}{sk.confidence && <Badge tone={sk.confidence === "stated" ? "green" : "amber"}>{sk.confidence === "stated" ? "They said so" : "Worked out"}</Badge>}</td></tr>
                ))}</tbody>
              </table>
            )}
          </section>
          <section className="card">
            <h2 className="border-b border-stone-200 px-4 py-3 text-sm font-semibold">Experience</h2>
            {p.experience.length === 0 && <p className="muted p-4 text-sm">Not known yet.</p>}
            {p.experience.map((e, i) => (
              <div key={i} className="border-b border-stone-100 px-4 py-3 text-sm last:border-b-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="font-semibold">{e.title}</span><span className="muted text-xs">{e.start} to {e.end ?? "present"}</span></div>
                <div className="muted text-xs">{e.company}{e.industry && ` · ${e.industry}`}{e.companySize && ` · ${SIZE_LABEL[e.companySize]}`}{e.teamSize && ` · team of ${e.teamSize}`}</div>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5">{e.responsibilities.map((r, j) => <li key={j}>{r}</li>)}</ul>
                {e.achievements.length > 0 && <ul className="mt-1 list-disc space-y-0.5 pl-5 text-emerald-800">{e.achievements.map((r, j) => <li key={j}>{r}</li>)}</ul>}
                {e.tools.length > 0 && <div className="muted mt-1.5 text-xs">{e.tools.join(" · ")}</div>}
              </div>
            ))}
          </section>
          <section id="personality" className="card p-4 text-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Personality and work style</h2>
              <span className="muted text-xs">{known} of {DIMENSIONS.length} scales known</span>
            </div>
            <PersonalityScales personality={pers} />
            {pers.interests.length > 0 && <div className="mt-4"><span className="muted text-xs">Interests they brought up: </span>{pers.interests.map((x) => <Badge key={x}>{x}</Badge>)}</div>}
            {pers.notes && <p className="mt-2"><span className="muted text-xs">Notes: </span>{pers.notes}</p>}
            {(p.workStyle.traits.length > 0 || p.workStyle.motivators.length > 0) && (
              <div className="mt-4 space-y-1.5 border-t border-stone-100 pt-3">
                {p.workStyle.traits.map((t, i) => <div key={i}><span className="font-medium">{t.trait}.</span>{t.evidence && <span className="muted"> {t.evidence}{t.source && ` (${SOURCE_LABEL[t.source].toLowerCase()})`}.</span>}</div>)}
                {p.workStyle.motivators.length > 0 && <div><span className="muted">Wants: </span>{p.workStyle.motivators.join("; ")}</div>}
                {p.workStyle.concerns.length > 0 && <div><span className="muted">Wants to avoid: </span>{p.workStyle.concerns.join("; ")}</div>}
                {p.workStyle.prefersCompanySize.length > 0 && <div><span className="muted">Prefers: </span>{p.workStyle.prefersCompanySize.map((x) => SIZE_LABEL[x]).join(", ")}</div>}
                {p.workStyle.communication && <div><span className="muted">Communication: </span>{p.workStyle.communication}</div>}
              </div>
            )}
            <details className="mt-4 border-t border-stone-100 pt-3">
              <summary className="cursor-pointer text-xs font-medium text-brand">Fill in or change by hand</summary>
              <form action={savePersonalityAction} className="mt-3 space-y-2">
                <input type="hidden" name="personId" value={id} />
                {DIMENSIONS.map((d) => {
                  const dim = pers.dimensions[d.key];
                  return (
                    <div key={d.key} className="grid items-center gap-2 sm:grid-cols-12">
                      <span className="text-xs font-medium sm:col-span-2">{d.label}</span>
                      <select name={`v_${d.key}`} defaultValue={dim?.value ?? ""} className="field py-1 text-xs sm:col-span-4">
                        <option value="">Not known</option>
                        {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v} · {describeDimension(d.key, v)}</option>)}
                      </select>
                      <input name={`e_${d.key}`} defaultValue={dim?.evidence ?? ""} placeholder="What makes you say so?" className="field py-1 text-xs sm:col-span-4" />
                      <select name={`c_${d.key}`} defaultValue={dim?.confidence ?? "inferred"} className="field py-1 text-xs sm:col-span-2"><option value="inferred">My reading</option><option value="stated">Their words</option></select>
                      <input type="hidden" name={`s_${d.key}`} value={dim?.source ?? "recruiter_note"} />
                    </div>
                  );
                })}
                <input name="interests" defaultValue={pers.interests.join(", ")} placeholder="Interests they brought up, separated by commas" className="field w-full py-1 text-xs" />
                <input name="notes" defaultValue={pers.notes ?? ""} placeholder="Anything else about how they come across" className="field w-full py-1 text-xs" />
                <button className="btn btn-primary">Save personality</button>
              </form>
            </details>
          </section>
          {p.screening?.summary && (
            <section className="card p-4 text-sm">
              <h2 className="mb-2 text-sm font-semibold">Screen {p.screening.date && <span className="muted font-normal">· {p.screening.date} · {p.screening.by === "retell_ai" ? "Retell AI call" : "call with you"}</span>}</h2>
              <p>{p.screening.summary}</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div><div className="muted text-xs font-medium">Strengths</div><ul className="list-disc pl-5">{p.screening.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                <div><div className="muted text-xs font-medium">Risks</div><ul className="list-disc pl-5">{p.screening.risks.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
              </div>
            </section>
          )}
          <section className="card">
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
              <h2 className="text-sm font-semibold">Where this came from ({sources.length})</h2>
              <Act action={compileCandidateAction} fields={{ personId: id }} title="Queues a job: Claude reads everything below and rewrites the profile">{uncompiled ? `Ask Claude to compile (${uncompiled} new)` : "Ask Claude to recompile"}</Act>
            </div>
            {sources.map((s) => (
              <details key={s.id} className="border-b border-stone-100 px-4 py-2.5 text-sm">
                <summary className="flex cursor-pointer items-center justify-between gap-2"><span><span className="font-medium">{SOURCE_LABEL[s.kind]}</span>{s.title && <span className="muted"> · {s.title}</span>}</span><span className="flex items-center gap-2"><span className="muted text-xs">{fmtDate(s.receivedAt)}</span><Badge tone={s.compiledAt ? "green" : "amber"}>{s.compiledAt ? "In the profile" : "Not compiled yet"}</Badge></span></summary>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-stone-50 p-3 font-sans text-xs leading-relaxed text-stone-700">{s.content}</pre>
              </details>
            ))}
            <form action={addSourceAction} className="space-y-2 p-4">
              <input type="hidden" name="personId" value={id} />
              <div className="flex flex-wrap gap-2">
                <select name="kind" className="field">{SOURCES.map((x) => <option key={x} value={x}>{SOURCE_LABEL[x]}</option>)}</select>
                <input name="title" placeholder="Label (optional)" className="field flex-1" />
              </div>
              <textarea name="content" required rows={4} placeholder="Paste a transcript, messages, a resume or notes. It is kept as pasted and queued for compiling." className="field w-full text-[13px]" />
              <button className="btn btn-primary">Add to this candidate</button>
            </form>
          </section>
          <details className="card p-4 text-sm">
            <summary className="cursor-pointer font-semibold">Edit the profile data directly</summary>
            <p className="muted mt-2 text-xs">This is the structured profile exactly as stored. Saving checks it against the schema and rebuilds the search vector.</p>
            <form action={saveProfileAction} className="mt-2 space-y-2">
              <input type="hidden" name="personId" value={id} />
              <textarea name="json" rows={24} defaultValue={JSON.stringify(p, null, 2)} className="field w-full font-mono text-xs" spellCheck={false} />
              <button className="btn btn-primary">Save profile</button>
            </form>
          </details>
        </div>
        <div className="space-y-6">
          {reach && (
            <section className="card p-4 text-sm">
              <h2 className="text-sm font-semibold">Reach out</h2>
              <form className="mt-1 mb-3 flex items-center gap-2">
                <span className="muted text-xs">About</span>
                <select name="role" defaultValue={roleId} className="field flex-1 py-1 text-xs">{roles.map((r) => <option key={r.searchId} value={r.searchId}>{r.title} ({r.structured}{r.missingMust.length ? ", missing a must-have" : ""})</option>)}</select>
                <button className="btn">Switch</button>
              </form>
              <CandidateOutreach person={person} searchId={reach.role.id} feeler={reach.feeler} retellLive={retellConfigured()} />
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-medium text-brand">See the words each button uses</summary>
                <div className="mt-2 space-y-2 text-xs">
                  {[["LinkedIn connection note", reach.feeler.note], ["LinkedIn message and email", reach.feeler.message], ["Text", reach.feeler.text]].map(([name, body]) => <div key={name}><div className="muted font-medium">{name}</div><pre className="whitespace-pre-wrap rounded-md bg-stone-50 p-2 font-sans leading-relaxed">{body}</pre></div>)}
                </div>
              </details>
              {reach.touches.length > 0 && <div className="mt-3 border-t border-stone-100 pt-2 text-xs">{reach.touches.slice(0, 4).map((t) => <div key={t.id} className="flex justify-between"><span>{t.notes}</span><span className="muted">{fmtDate(t.occurredAt)}</span></div>)}</div>}
              {calls.map((c) => (
                <div key={c.id} className="mt-2 flex items-center justify-between gap-2 border-t border-stone-100 pt-2 text-xs">
                  <span><span className="font-medium">AI screen call:</span> {label(c.status)}. <span className="muted">{c.detail}</span></span>
                  {(c.status === "requested" || c.status === "in_progress") && <Act action={refreshScreenCallAction} fields={{ id: c.id }}>Check for transcript</Act>}
                </div>
              ))}
            </section>
          )}
          <section id="consent" className="card p-4 text-sm">
            <h2 className="mb-1 text-sm font-semibold">Automated calls and texts</h2>
            <p className="muted mb-2 text-xs">An AI screen call may only go to someone who agreed to one. Tick this once they have, and say how.</p>
            <form action={consentAction} className="space-y-2">
              <input type="hidden" name="personId" value={id} />
              <label className="flex items-center gap-2"><input type="checkbox" name="agreed" defaultChecked={person.aiContactConsent} className="accent-teal-700" /> <span>Agreed to an automated call or text</span></label>
              <input name="note" defaultValue={person.consentNote ?? ""} placeholder="How and when, e.g. ticked the box on the application, Nov 17" className="field w-full py-1 text-xs" />
              <button className="btn">Save</button>
            </form>
          </section>
          <section className="card p-4 text-sm">
            <h2 className="mb-2 text-sm font-semibold">The basics</h2>
            <dl className="space-y-1.5">
              {[["Open to", p.location.workplace ? `${label(p.location.workplace)}${p.location.willRelocate ? ", would relocate" : ""}` : null], ["Status", p.availability.status ? `${label(p.availability.status)}${p.availability.noticeWeeks != null ? `, ${p.availability.noticeWeeks} weeks notice` : ""}` : null],
                ["Pay now", p.compensation.currentBase ? k(p.compensation.currentBase) : null], ["Wants", p.compensation.targetBase ? `${k(p.compensation.targetBase)} (will not go below ${k(p.compensation.minimumBase)})` : null], ["Work authorization", p.workAuthorization],
                ["Looking for", p.targetRoles.join(", ") || null], ["Education", p.education.map((e) => `${e.degree ?? ""} ${e.field ?? ""}, ${e.school}`.trim()).join("; ") || null], ["Certifications", p.certifications.join("; ") || null], ["Email", person.email], ["Phone", person.phone]].map(([key, val]) => (
                <div key={key as string} className="flex gap-2"><dt className="muted w-32 shrink-0 text-xs">{key}</dt><dd className={val ? "" : "muted"}>{val ?? "Unknown"}</dd></div>
              ))}
            </dl>
          </section>
          {check.missing.length > 0 && (
            <section className="card p-4 text-sm">
              <h2 className="mb-2 text-sm font-semibold">Still missing</h2>
              <ul className="space-y-2">{check.missing.map((m) => <li key={m.field}><div className="font-medium">{m.field}</div><div className="muted text-xs">Usually from: {m.fill}</div></li>)}</ul>
            </section>
          )}
          <section className="card">
            <h2 className="border-b border-stone-200 px-4 py-3 text-sm font-semibold">Best-fitting open roles</h2>
            {roles.length === 0 && <p className="muted p-4 text-sm">No open roles.</p>}
            {roles.slice(0, 5).map((r) => (
              <Link key={r.searchId} href={`/sourcing/searches/${r.searchId}`} className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-2.5 text-sm last:border-b-0 hover:bg-stone-50">
                <span className="min-w-0"><span className="block truncate font-medium">{r.title}</span><span className="muted block truncate text-xs">{r.client}{r.missingMust.length > 0 && ` · no ${r.missingMust.join(", ")}`}</span></span>
                <Badge tone={r.missingMust.length ? "gray" : r.structured >= 80 ? "green" : "amber"}>{r.structured}</Badge>
              </Link>
            ))}
          </section>
          {c.searches.length > 0 && (
            <section className="card p-4 text-sm">
              <h2 className="mb-2 text-sm font-semibold">In these pipelines</h2>
              {c.searches.map(({ link, search }) => <div key={link.id} className="flex justify-between py-0.5"><Link href={`/sourcing/searches/${search.id}`} className="text-brand hover:underline">{search.title}</Link><span className="muted">{label(link.stage)}</span></div>)}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
