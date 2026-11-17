/**
 * The candidate list: one compiled profile per person, built from whatever we have on them.
 *
 *   sources (LinkedIn paste, resume, application, screen call, messages)
 *     -> a Claude run reads them and writes the structured profile
 *     -> the app turns the profile into prose and a vector, and scores completeness
 */
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { completeness, personalityOf, profileChunks, profileSchema, profileText, type DimensionKey, type Personality, type Profile, type Source } from "./candidate-schema";
import { embed } from "./embeddings";
import { queueJob, upsertPerson } from "./index";

const holder = globalThis as unknown as { __sheerflowCandidates?: Promise<void> };
/**
 * First run only: load the made-up candidates and roles so the list and matching can be tried.
 * They are marked as samples and can be removed in one click on the Candidates screen.
 */
export function candidatesReady() {
  return (holder.__sheerflowCandidates ??= (async () => {
    const db = await getDb();
    const [done] = await db.select().from(s.settings).where(eq(s.settings.key, "sample_candidates_loaded"));
    if (done) return;
    await db.insert(s.settings).values({ key: "sample_candidates_loaded", value: true }).onConflictDoNothing();
    const { sampleCandidates, SAMPLE_ROLES } = await import("@/db/sample-candidates");
    const { saveRole } = await import("./matching");
    for (const c of sampleCandidates()) {
      const { person } = await upsertPerson({ name: c.name, linkedinUrl: c.linkedinUrl, email: c.email, type: "candidate" });
      for (const src of c.sources) await db.insert(s.candidateSources).values({ personId: person.id, kind: src.kind, title: src.title, content: src.content, compiledAt: new Date() });
      await saveCandidateProfile(person.id, c.profile, { isSample: true });
    }
    for (const r of SAMPLE_ROLES) {
      const id = await saveRole({ title: r.title, clientName: r.clientName, description: r.description, requirements: r.requirements, isSample: true });
      await db.update(s.searches).set({ compRange: r.compRange }).where(eq(s.searches.id, id));
    }
  })());
}

/** Save a profile for a person: validate it, rebuild its prose, vector and completeness. */
export async function saveCandidateProfile(personId: number, input: unknown, opts: { isSample?: boolean; markSourcesCompiled?: boolean } = {}) {
  const db = await getDb();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) throw new Error("Profile does not fit the schema: " + parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const profile: Profile = parsed.data;
  const [person] = await db.select().from(s.people).where(eq(s.people.id, personId));
  if (!person) throw new Error(`No person with id ${personId}`);
  const text = profileText(person.name, profile);
  // One vector for the whole profile (used to match roles), and one per part (used for search).
  const chunks = profileChunks(profile);
  const [embedding, ...chunkVectors] = await embed([text, ...chunks.map((c) => c.content)]);
  await db.delete(s.candidateChunks).where(eq(s.candidateChunks.personId, personId));
  if (chunks.length) await db.insert(s.candidateChunks).values(chunks.map((c, i) => ({ personId, kind: c.kind, content: c.content, embedding: chunkVectors[i] })));
  const values = { profile, profileText: text, embedding, completeness: completeness(profile).score, updatedAt: new Date() };
  await db.insert(s.candidateProfiles).values({ personId, ...values, isSample: opts.isSample ?? false }).onConflictDoUpdate({ target: s.candidateProfiles.personId, set: values });
  // Keep the person record's headline fields in step with the profile.
  const latest = profile.experience[0];
  await db.update(s.people).set({
    type: "candidate", title: profile.headline ?? latest?.title ?? person.title, currentEmployer: latest && !latest.end ? latest.company : person.currentEmployer,
    location: [profile.location.city, profile.location.state].filter(Boolean).join(", ") || person.location, skills: profile.skills.map((x) => x.name).join(", ") || person.skills,
  }).where(eq(s.people.id, personId));
  if (opts.markSourcesCompiled) await db.update(s.candidateSources).set({ compiledAt: new Date() }).where(and(eq(s.candidateSources.personId, personId), isNull(s.candidateSources.compiledAt)));
  return { personId, completeness: completeness(profile) };
}

/**
 * Change part of a candidate's personality without touching the rest of the profile.
 * A scale set to null is cleared. Used by the form on the candidate page and by Claude after a screen call.
 */
export async function updatePersonality(personId: number, input: { dimensions?: Partial<Record<DimensionKey, { value: number; evidence?: string; source?: Source; confidence?: "stated" | "inferred" } | null>>; interests?: string[]; notes?: string }) {
  const db = await getDb();
  const [row] = await db.select().from(s.candidateProfiles).where(eq(s.candidateProfiles.personId, personId));
  if (!row) throw new Error(`No candidate with id ${personId}`);
  const current = personalityOf(row.profile);
  const dimensions: Personality["dimensions"] = { ...current.dimensions };
  for (const [key, val] of Object.entries(input.dimensions ?? {}) as [DimensionKey, { value: number } | null][]) { if (val == null) delete dimensions[key]; else dimensions[key] = val; }
  const personality: Personality = { dimensions, interests: input.interests ?? current.interests, notes: input.notes ?? current.notes };
  return saveCandidateProfile(personId, { ...row.profile, personality }, { isSample: row.isSample });
}

/** Add a candidate (or find them by LinkedIn URL) with an empty profile, ready for sources. */
export async function createCandidate(input: { name: string; linkedinUrl?: string; email?: string; phone?: string }) {
  const { person } = await upsertPerson({ name: input.name, linkedinUrl: input.linkedinUrl, email: input.email, phone: input.phone, type: "candidate" });
  const db = await getDb();
  await db.update(s.people).set({ type: "candidate" }).where(eq(s.people.id, person.id));
  const [existing] = await db.select({ id: s.candidateProfiles.personId }).from(s.candidateProfiles).where(eq(s.candidateProfiles.personId, person.id));
  if (!existing) await saveCandidateProfile(person.id, {});
  return person.id;
}

/** Keep a piece of raw material about a candidate and queue a Claude job to work it into the profile. */
export async function addCandidateSource(input: { personId: number; kind: s.CandidateSourceKind; title?: string; content: string; queue?: boolean }) {
  const db = await getDb();
  if (!input.content.trim()) throw new Error("There is nothing to save");
  const [person] = await db.select().from(s.people).where(eq(s.people.id, input.personId));
  if (!person) throw new Error(`No person with id ${input.personId}`);
  const [source] = await db.insert(s.candidateSources).values({ personId: input.personId, kind: input.kind, title: input.title?.trim() || null, content: input.content.trim() }).returning();
  if (input.queue !== false) await queueCompile(input.personId);
  return source;
}

export async function queueCompile(personId: number) {
  const db = await getDb();
  const [person] = await db.select().from(s.people).where(eq(s.people.id, personId));
  const pending = (await db.select().from(s.jobs).where(and(eq(s.jobs.kind, "compile_candidate"), eq(s.jobs.status, "queued")))).some((j) => j.payload.personId === personId);
  if (!pending) await queueJob({ kind: "compile_candidate", title: `Compile the profile for ${person?.name ?? "a candidate"}`, payload: { personId } });
}

export async function listCandidates() {
  await candidatesReady();
  const db = await getDb();
  return db.select({ person: s.people, cp: { profile: s.candidateProfiles.profile, completeness: s.candidateProfiles.completeness, isSample: s.candidateProfiles.isSample, updatedAt: s.candidateProfiles.updatedAt } })
    .from(s.candidateProfiles).innerJoin(s.people, eq(s.candidateProfiles.personId, s.people.id)).orderBy(asc(s.people.name));
}

export async function getCandidate(personId: number) {
  await candidatesReady();
  const db = await getDb();
  const [row] = await db.select({ person: s.people, profile: s.candidateProfiles.profile, profileText: s.candidateProfiles.profileText, completeness: s.candidateProfiles.completeness, isSample: s.candidateProfiles.isSample, updatedAt: s.candidateProfiles.updatedAt })
    .from(s.candidateProfiles).innerJoin(s.people, eq(s.candidateProfiles.personId, s.people.id)).where(eq(s.candidateProfiles.personId, personId));
  if (!row) return null;
  const sources = await db.select().from(s.candidateSources).where(eq(s.candidateSources.personId, personId)).orderBy(desc(s.candidateSources.receivedAt));
  const searches = await db.select({ link: s.searchCandidates, search: s.searches }).from(s.searchCandidates).innerJoin(s.searches, eq(s.searchCandidates.searchId, s.searches.id)).where(eq(s.searchCandidates.personId, personId));
  return { ...row, sources, searches, check: completeness(row.profile) };
}

/** Put a candidate into a role's pipeline (or leave them where they are if already in it). */
export async function addToSearch(searchId: number, personId: number, fitScore?: number, fitNotes?: string) {
  const db = await getDb();
  const [existing] = await db.select().from(s.searchCandidates).where(and(eq(s.searchCandidates.searchId, searchId), eq(s.searchCandidates.personId, personId)));
  if (existing) return existing;
  return (await db.insert(s.searchCandidates).values({ searchId, personId, stage: "sourced", fitScore, fitNotes, source: "Matched in the app" }).returning())[0];
}

/** Remove the made-up candidates and roles that ship for trying the app. */
export async function clearSampleCandidates() {
  const db = await getDb();
  const sample = (await db.select({ id: s.candidateProfiles.personId }).from(s.candidateProfiles).where(eq(s.candidateProfiles.isSample, true))).map((r) => r.id);
  const roles = (await db.select({ id: s.searches.id }).from(s.searches).where(eq(s.searches.isSample, true))).map((r) => r.id);
  for (const id of roles) await db.delete(s.searchCandidates).where(eq(s.searchCandidates.searchId, id));
  for (const id of sample) {
    await db.delete(s.searchCandidates).where(eq(s.searchCandidates.personId, id));
    await db.delete(s.candidateSources).where(eq(s.candidateSources.personId, id));
    await db.delete(s.candidateChunks).where(eq(s.candidateChunks.personId, id));
    await db.delete(s.candidateProfiles).where(eq(s.candidateProfiles.personId, id));
    await db.execute(sql`delete from people p where p.id = ${id} and not exists (select 1 from placements pl where pl.person_id = p.id)`);
  }
  for (const id of roles) await db.delete(s.searches).where(eq(s.searches.id, id));
  return { candidates: sample.length, roles: roles.length };
}
