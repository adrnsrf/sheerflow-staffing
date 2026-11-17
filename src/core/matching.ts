/**
 * Matching candidates to roles.
 *
 * Two scores, on purpose:
 *  - a structured score from facts that have a right answer: years on each required tool,
 *    total experience, company size, location and pay;
 *  - a similarity score from vector search: how close the candidate's whole profile reads to
 *    the job description (the kind of work, the setting, the way they work).
 *
 * Vectors alone are not enough for this job. To an embedding, "five years of Snowflake" and
 * "one year of Snowflake" look almost the same, and Azure sits close to AWS. So the vector finds
 * people who do the right kind of work, and the structured score checks the requirements.
 * Every match explains itself.
 */
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { COMPANY_SIZES, canonTool, toolsIn, toolYears, type Profile } from "./candidate-schema";
import { candidatesReady } from "./candidates";
import { embed, toVector } from "./embeddings";

export type Requirements = {
  tools: { name: string; minYears: number; must: boolean }[];
  minTotalYears?: number;
  companySize?: (typeof COMPANY_SIZES)[number];
  workplace?: "remote" | "hybrid" | "onsite";
  city?: string; state?: string;
  maxBase?: number;
};

export const WEIGHTS = { structured: 0.65, similarity: 0.35, tools: 0.55, experience: 0.15, companySize: 0.1, location: 0.1, pay: 0.1 };

/**
 * A first reading of a job description: which known tools it names, how many years it asks
 * for, the setting and the pay. Good enough to start matching at once; a Claude run (or you)
 * can refine it on the role page.
 */
export function extractRequirements(text: string): Requirements {
  const lower = text.toLowerCase();
  // "Nice to have: X and Y." marks tools as optional, up to the end of that sentence.
  const nice = (lower.match(/(nice to have|preferred|bonus|a plus)[^.]*\./g) ?? []).join(" ");
  const esc = (x: string) => x.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tools = toolsIn(text).map((name) => {
    // "3+ years of Snowflake", "4+ years on AWS", "2 years of experience with dbt"
    const m = lower.match(new RegExp(`(\\d+)\\+?\\s*(?:years|yrs)\\s+(?:of\\s+|on\\s+|with\\s+|in\\s+|using\\s+)?(?:hands-on\\s+)?(?:experience\\s+(?:with|in|on)\\s+)?${esc(name)}`));
    const inNice = toolsIn(nice).includes(name), elsewhere = toolsIn(lower.replace(nice, " ")).includes(name);
    return { name, minYears: m ? Number(m[1]) : 1, must: !inNice || (elsewhere && !!m) };
  });
  const total = lower.match(/(\d+)\+?\s*(?:years|yrs)[^.]{0,40}(?:experience|in data|data engineering|analytics)/);
  // Company size: a stated headcount wins; otherwise go by the words used.
  const heads = lower.match(/(\d[\d,]*)[- ]?(?:person|people|employees)/);
  const n = heads ? Number(heads[1].replace(/,/g, "")) : null;
  const size: Requirements["companySize"] = n ? (n < 50 ? "startup" : n < 200 ? "small" : n < 1000 ? "mid" : n < 10000 ? "large" : "enterprise")
    : /fortune 500|enterprise/.test(lower) ? "enterprise" : /large (company|organization)|global/.test(lower) ? "large" : /startup|seed|series a|founding/.test(lower) ? "startup"
    : /series [bc]|scale-?up|small company|growing company/.test(lower) ? "small" : /mid-?size|mid-?market/.test(lower) ? "mid" : undefined;
  const pay = [...lower.matchAll(/\$\s?(\d{2,3})[,.]?(\d{3})?k?/g)].map((m) => (m[2] ? Number(m[1] + m[2]) : Number(m[1]) * 1000)).filter((n) => n >= 50_000 && n <= 500_000);
  const place = text.match(/\b(?:in|based in|located in)\s+([A-Z][a-zA-Z .]+),\s*([A-Z]{2})\b/);
  return {
    tools, minTotalYears: total ? Number(total[1]) : undefined, companySize: size,
    workplace: /fully remote|remote[- ]first|\bremote\b/.test(lower) && !/not remote|no remote/.test(lower) ? "remote" : /hybrid/.test(lower) ? "hybrid" : /on-?site|in office/.test(lower) ? "onsite" : undefined,
    city: place?.[1]?.trim(), state: place?.[2], maxBase: pay.length ? Math.max(...pay) : undefined,
  };
}

export type MatchPart = { label: string; score: number; note: string };
export type Match = {
  personId: number; name: string; headline?: string; score: number; structured: number; similarity: number; rawSimilarity: number;
  tools: { name: string; must: boolean; need: number; has: number }[]; missingMust: string[]; parts: MatchPart[];
};

/** Score one profile against one set of requirements. Pure: no database, easy to test. */
export function scoreStructured(p: Profile, req: Requirements) {
  const years = toolYears(p);
  const tools = req.tools.map((t) => ({ name: t.name, must: t.must, need: t.minYears, has: years.get(canonTool(t.name)) ?? 0 }));
  const weightOf = (t: { must: boolean }) => (t.must ? 2 : 1);
  const toolScore = tools.length ? tools.reduce((n, t) => n + weightOf(t) * Math.min(1, t.need > 0 ? t.has / t.need : t.has > 0 ? 1 : 0), 0) / tools.reduce((n, t) => n + weightOf(t), 0) : 0.5;
  const missingMust = tools.filter((t) => t.must && t.has === 0).map((t) => t.name);
  const parts: MatchPart[] = [];
  const met = tools.filter((t) => t.has >= t.need).length;
  parts.push({ label: "Tools", score: toolScore, note: tools.length ? `${met} of ${tools.length} tools at the years asked${missingMust.length ? `; no ${missingMust.join(", ")}` : ""}` : "The role lists no tools" });

  const exp = req.minTotalYears ? Math.min(1, (p.totalYears ?? 0) / req.minTotalYears) : 0.75;
  parts.push({ label: "Experience", score: exp, note: req.minTotalYears ? `${p.totalYears ?? "Unknown"} years, role asks ${req.minTotalYears}+` : `${p.totalYears ?? "Unknown"} years (role sets no minimum)` });

  const worked = new Set(p.experience.map((e) => e.companySize).filter(Boolean));
  const near = (a: string, b: string) => Math.abs(COMPANY_SIZES.indexOf(a as never) - COMPANY_SIZES.indexOf(b as never)) <= 1;
  let size = 0.6, sizeNote = "Role does not say what size the company is";
  if (req.companySize) {
    const prefers = p.workStyle.prefersCompanySize;
    if (prefers.length && !prefers.some((x) => near(x, req.companySize!))) { size = 0.1; sizeNote = `Prefers ${prefers.join(" or ")} companies; this one is ${req.companySize}`; }
    else if (worked.has(req.companySize)) { size = 1; sizeNote = `Has worked at ${req.companySize} companies`; }
    else if ([...worked].some((w) => near(w!, req.companySize!))) { size = 0.7; sizeNote = `Has worked at companies close to ${req.companySize} in size`; }
    else if (worked.size) { size = 0.3; sizeNote = `Only ${[...worked].join(" and ")} companies so far; this one is ${req.companySize}`; }
    else { size = 0.5; sizeNote = "Company sizes not on file"; }
  }
  parts.push({ label: "Company size", score: size, note: sizeNote });

  let loc = 0.6, locNote = "Role does not say where it is";
  const wp = p.location.workplace;
  if (req.workplace === "remote") { loc = wp === "onsite" ? 0.4 : 1; locNote = wp === "onsite" ? "Role is remote; they prefer an office" : "Role is remote"; }
  else if (req.workplace) {
    const sameState = !!req.state && req.state === p.location.state, sameCity = sameState && !!req.city && req.city.toLowerCase() === (p.location.city ?? "").toLowerCase();
    if (sameCity) { loc = wp === "remote" ? 0.6 : 1; locNote = `Lives in ${req.city}${wp === "remote" ? ", but wants remote" : ""}`; }
    else if (p.location.willRelocate) { loc = 0.6; locNote = `Not in ${req.city ?? req.state ?? "the area"}, open to moving`; }
    else if (sameState) { loc = 0.5; locNote = `Same state, not ${req.city}`; }
    else { loc = wp === "remote" ? 0 : 0.15; locNote = `Role is ${req.workplace} in ${req.city ?? req.state ?? "one place"}; they are in ${p.location.city ?? p.location.state ?? "an unknown place"}`; }
  }
  parts.push({ label: "Location", score: loc, note: locNote });

  let pay = 0.6, payNote = "Pay not on file for one side";
  const ask = p.compensation.minimumBase ?? p.compensation.targetBase;
  if (req.maxBase && ask) {
    pay = ask <= req.maxBase ? 1 : ask <= req.maxBase * 1.1 ? 0.5 : 0;
    payNote = `Asks $${Math.round(ask / 1000)}k; role pays up to $${Math.round(req.maxBase / 1000)}k`;
  }
  parts.push({ label: "Pay", score: pay, note: payNote });

  const w = WEIGHTS;
  const structured = w.tools * toolScore + w.experience * exp + w.companySize * size + w.location * loc + w.pay * pay;
  return { structured, tools, missingMust, parts };
}

type Row = { person_id: number; name: string; profile: Profile; sim: number };

async function rank(vector: number[], req: Requirements, limit: number): Promise<Match[]> {
  const db = await getDb();
  const v = toVector(vector);
  const rows = (await db.execute(sql`
    select cp.person_id, p.name, cp.profile, 1 - (cp.embedding <=> ${v}::vector) as sim
    from candidate_profiles cp join people p on p.id = cp.person_id
    where cp.embedding is not null order by cp.embedding <=> ${v}::vector`)).rows as unknown as Row[];
  if (rows.length === 0) return [];
  // Similarity is spread across the pool (best = 1, worst = 0) so it can be combined with the structured score.
  const sims = rows.map((r) => Number(r.sim)), hi = Math.max(...sims), lo = Math.min(...sims);
  return rows.map((r) => {
    const st = scoreStructured(r.profile, req);
    const similarity = hi > lo ? (Number(r.sim) - lo) / (hi - lo) : 1;
    // Missing a must-have tool outright caps the match: it can be listed, but never near the top.
    const cap = st.missingMust.length ? 0.55 : 1;
    const score = Math.min(cap, WEIGHTS.structured * st.structured + WEIGHTS.similarity * similarity);
    return { personId: r.person_id, name: r.name, headline: r.profile.headline, score: Math.round(score * 100), structured: Math.round(st.structured * 100), similarity: Math.round(similarity * 100), rawSimilarity: Number(Number(r.sim).toFixed(3)), tools: st.tools, missingMust: st.missingMust, parts: st.parts };
  }).sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Text a role is embedded from: the description plus its title and setting. */
export const roleText = (r: { title: string; description: string | null; requirements: Requirements | null }) =>
  [r.title + ".", r.description ?? "", r.requirements?.companySize ? `A ${r.requirements.companySize} company.` : ""].join(" ").trim();

/** Rank every candidate for a role. */
export async function matchRole(searchId: number, limit = 25): Promise<Match[]> {
  await candidatesReady();
  const db = await getDb();
  const [role] = await db.select().from(s.searches).where(eq(s.searches.id, searchId));
  if (!role) throw new Error(`No role with id ${searchId}`);
  const vec = role.embedding ?? (await embedRole(searchId));
  return rank(vec, role.requirements ?? extractRequirements(role.description ?? role.title), limit);
}

/** Try any job description without saving it. */
export async function matchText(text: string, limit = 25) {
  await candidatesReady();
  const requirements = extractRequirements(text);
  const [vec] = await embed([text]);
  return { requirements, matches: await rank(vec, requirements, limit) };
}

const PART_LABEL = { summary: "Summary", tools: "Tools", experience: "A job they held", work_style: "How they work" } as const;

/**
 * Plain vector search over candidates: "who is like this?" The query is compared with every
 * part of every profile and each candidate is ranked by their closest part, which is returned
 * so you can see why they came up.
 */
export async function searchCandidates(query: string, limit = 30) {
  await candidatesReady();
  const db = await getDb();
  const [vec] = await embed([query]);
  const v = toVector(vec);
  const wanted = toolsIn(query);
  const rows = (await db.execute(sql`
    select distinct on (c.person_id) c.person_id, c.kind, c.content, 1 - (c.embedding <=> ${v}::vector) as sim, cp.profile
    from candidate_chunks c join candidate_profiles cp on cp.person_id = c.person_id
    where c.embedding is not null
    order by c.person_id, c.embedding <=> ${v}::vector`)).rows as unknown as { person_id: number; kind: keyof typeof PART_LABEL; content: string; sim: number; profile: Profile }[];
  return rows.map((r) => {
    const years = toolYears(r.profile);
    const toolHits = wanted.filter((t) => years.has(t));
    // Naming a tool the candidate has is a small, fair nudge on top of closeness.
    const similarity = Number(r.sim) + (wanted.length ? 0.1 * (toolHits.length / wanted.length) : 0);
    return { personId: r.person_id, similarity: Number(similarity.toFixed(3)), matchedOn: PART_LABEL[r.kind], snippet: r.content.slice(0, 220), toolHits: toolHits.map((t) => `${t} ${years.get(t)}y`) };
  }).sort((a, b) => b.similarity - a.similarity).slice(0, limit);
}

/** Which open roles suit one candidate best. */
export async function rolesForCandidate(personId: number) {
  await candidatesReady();
  const db = await getDb();
  const [cp] = await db.select().from(s.candidateProfiles).where(eq(s.candidateProfiles.personId, personId));
  if (!cp) return [];
  const roles = await db.select().from(s.searches).where(and(eq(s.searches.status, "open"), isNotNull(s.searches.embedding)));
  const cos = (a: number[], b: number[]) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return d / Math.sqrt(x * y); };
  return roles.map((r) => {
    const st = scoreStructured(cp.profile, r.requirements ?? { tools: [] });
    const sim = cp.embedding && r.embedding ? cos(cp.embedding, r.embedding) : 0;
    return { searchId: r.id, title: r.title, client: r.clientName, structured: Math.round(st.structured * 100), similarity: Number(sim.toFixed(3)), missingMust: st.missingMust };
  }).sort((a, b) => (b.missingMust.length ? 0 : 1) - (a.missingMust.length ? 0 : 1) || b.structured - a.structured);
}

export async function embedRole(searchId: number) {
  const db = await getDb();
  const [role] = await db.select().from(s.searches).where(eq(s.searches.id, searchId));
  const [vec] = await embed([roleText(role)]);
  await db.update(s.searches).set({ embedding: vec }).where(eq(s.searches.id, searchId));
  return vec;
}

/** Create or update a role. Requirements are read from the description unless given. */
export async function saveRole(input: { id?: number; title: string; clientName?: string; companyId?: number; description: string; requirements?: Requirements; isSample?: boolean }) {
  const db = await getDb();
  const requirements = input.requirements ?? extractRequirements(`${input.title}. ${input.description}`);
  const values = { title: input.title.trim(), clientName: input.clientName?.trim() || null, companyId: input.companyId ?? null, description: input.description.trim(), requirements,
    stack: requirements.tools.map((t) => t.name).join(", "), mustHaves: requirements.tools.filter((t) => t.must).map((t) => `${t.name} ${t.minYears}+ yrs`).join(", ") };
  const id = input.id ? (await db.update(s.searches).set(values).where(eq(s.searches.id, input.id)).returning())[0].id
    : (await db.insert(s.searches).values({ ...values, isSample: input.isSample ?? false }).returning())[0].id;
  await embedRole(id);
  return id;
}
