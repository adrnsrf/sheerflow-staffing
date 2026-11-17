/**
 * Reading the signal model (the views in models/) and feeding its base tables.
 *
 *   base tables (signals, job_postings, apollo_intent, call_log, people, companies)
 *     -> staging views, one per source, all in one shape
 *     -> signals_fact: every signal event, scored
 *     -> company_heat / person_heat: the case for acting now
 */
import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { normalizeDomain, upsertCompany } from "./index";
import { checkStaffing } from "./staffing";

export type FactRow = {
  signal_id: string; level: "company" | "person"; company_id: number | null; person_id: number | null; signal_type: string; type_label: string; source: string;
  occurred_at: Date; title: string; detail: string | null; url: string | null; weight: number; half_life_days: number; age_days: number; score: number;
};
export type CompanyHeat = { company_id: number; heat: number; fit: number; priority: number; signal_count: number; last_signal_at: Date | null; top_reasons: string[] };
export type PersonHeat = { person_id: number; heat: number; signal_count: number; last_signal_at: Date; freshest_days: number; top_reasons: string[]; top_type: string };

// Raw view rows come back with timestamps as text; turn the date columns into real dates.
const DATE_COLS = ["occurred_at", "last_signal_at"];
const rows = async <T>(q: ReturnType<typeof sql>) =>
  ((await (await getDb()).execute(q)).rows as Record<string, unknown>[]).map((r) => {
    for (const k of DATE_COLS) if (typeof r[k] === "string") r[k] = new Date(r[k] as string);
    return r as T;
  });

/** Every scored signal for one company (its own and its people's), strongest first. */
export const companySignals = (companyId: number) => rows<FactRow>(sql`select * from signals_fact where company_id = ${companyId} order by score desc, occurred_at desc limit 50`);
export const companyHeat = async (companyId: number) => (await rows<CompanyHeat>(sql`select * from company_heat where company_id = ${companyId}`))[0] ?? null;
export const allCompanyHeat = () => rows<CompanyHeat>(sql`select * from company_heat`);
export const allPersonHeat = () => rows<PersonHeat>(sql`select * from person_heat`);

/** How each signal type is weighted, with how many signals of that type exist right now. */
export async function listSignalTypes() {
  const types = await (await getDb()).select().from(s.signalTypes).orderBy(asc(s.signalTypes.level), sql`${s.signalTypes.weight} desc`);
  const counts = await rows<{ signal_type: string; n: number; points: number }>(sql`select signal_type, count(*)::int as n, round(sum(score)::numeric)::int as points from signals_fact group by 1`);
  return types.map((t) => ({ ...t, count: counts.find((c) => c.signal_type === t.type)?.n ?? 0, points: counts.find((c) => c.signal_type === t.type)?.points ?? 0 }));
}

export async function updateSignalType(type: string, weight: number, halfLifeDays: number) {
  if (!(weight >= 0 && weight <= 100) || !(halfLifeDays >= 1 && halfLifeDays <= 730)) throw new Error("Weight must be 0 to 100 and half-life 1 to 730 days");
  await (await getDb()).update(s.signalTypes).set({ weight: Math.round(weight), halfLifeDays: Math.round(halfLifeDays) }).where(eq(s.signalTypes.type, type));
}

/** Record Apollo buying intent for companies. One reading per company, topic and day. Staffing firms are skipped. */
export async function addApolloIntent(readings: { companyName: string; domain?: string; apolloId?: string; topic: string; level: "high" | "medium" | "low"; observedAt?: string }[]) {
  const db = await getDb();
  const res = { readings: readings.length, added: 0, alreadyThere: 0, staffingDropped: 0, companiesAdded: 0 };
  for (const r of readings) {
    if (await checkStaffing(r.companyName, "Apollo intent")) { res.staffingDropped++; continue; }
    const { company, created } = await upsertCompany({ name: r.companyName, domain: normalizeDomain(r.domain) ?? undefined, apolloId: r.apolloId });
    if (created) res.companiesAdded++;
    const at = r.observedAt ? new Date(r.observedAt) : new Date();
    const dedupeKey = `${company.id}|${r.topic.toLowerCase()}|${at.toISOString().slice(0, 10)}`;
    const inserted = await db.insert(s.apolloIntent).values({ companyId: company.id, topic: r.topic, level: r.level, observedAt: at, dedupeKey }).onConflictDoNothing().returning();
    if (inserted.length) res.added++; else res.alreadyThere++;
  }
  return res;
}

/** Record data roles Apollo shows as open at a company. Deduped on Apollo's posting id (or company + title). */
export async function addApolloJobPostings(postings: { companyId: number; title: string; location?: string; url?: string; postedAt?: string; apolloPostingId?: string }[]) {
  const db = await getDb();
  const res = { postings: postings.length, added: 0, alreadyThere: 0 };
  for (const p of postings) {
    const [company] = await db.select().from(s.companies).where(eq(s.companies.id, p.companyId));
    if (!company) throw new Error(`No company with id ${p.companyId}`);
    const externalId = `apollo:${p.apolloPostingId ?? `${p.companyId}:${p.title.toLowerCase()}`}`;
    const inserted = await db.insert(s.jobPostings).values({
      externalId, title: p.title, companyName: company.name, companyId: company.id, location: p.location, url: p.url, source: "Apollo job postings", status: "kept",
      receivedAt: p.postedAt ? new Date(p.postedAt) : new Date(),
    }).onConflictDoNothing().returning();
    if (inserted.length) res.added++; else res.alreadyThere++;
  }
  return res;
}
