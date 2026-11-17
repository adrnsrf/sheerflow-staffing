/**
 * Phone numbers are their own table, so a bad number is a fact about the number, not the
 * company. Each number records where it came from (Apollo, Claude research, the call sheet,
 * typed in by hand) and its status is learned from the call log.
 */
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";

/** Digits only, without a leading US 1: "+1 (216) 538-8265" and "216.538.8265" both become "2165388265". */
export function phoneDigits(n: string) {
  const d = n.replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}

/** Find phone numbers written inside free text such as a call note. */
export function extractPhones(text: string): string[] {
  return (text.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g) ?? []).map((x) => x.trim());
}

const TOLL_FREE = /^(800|833|844|855|866|877|888)/;

export type PhoneInput = { companyId?: number | null; personId?: number | null; number: string; kind?: s.PhoneKind; label?: string | null; source: s.PhoneSource; sourceDetail?: string | null };

/** Add a number, or return the one already on file for that company or person. Never overwrites. */
export async function addPhone(input: PhoneInput) {
  const db = await getDb();
  const digits = phoneDigits(input.number);
  if (digits.length < 7) return null;
  const owner = input.personId ? eq(s.phoneNumbers.personId, input.personId) : and(isNull(s.phoneNumbers.personId), input.companyId ? eq(s.phoneNumbers.companyId, input.companyId) : isNull(s.phoneNumbers.companyId));
  const [existing] = await db.select().from(s.phoneNumbers).where(and(eq(s.phoneNumbers.digits, digits), owner)).limit(1);
  if (existing) return { phone: existing, created: false };
  const kind = input.kind && input.kind !== "unknown" ? input.kind : TOLL_FREE.test(digits) ? "toll_free" : input.personId ? "direct" : /office|branch|location/i.test(input.label ?? "") ? "company_office" : "company_main";
  const [phone] = await db.insert(s.phoneNumbers).values({ companyId: input.companyId, personId: input.personId, number: input.number.trim(), digits, kind, label: input.label, source: input.source, sourceDetail: input.sourceDetail }).returning();
  return { phone, created: true };
}

export type PhoneWithStats = typeof s.phoneNumbers.$inferSelect & { dials: number; bad: number; gatekeeper: number; reached: number };

/** Every number for these companies (company lines and their people's lines), each with what the call log says about it. */
export async function phonesForCompanies(companyIds: number[]): Promise<Map<number, PhoneWithStats[]>> {
  const out = new Map<number, PhoneWithStats[]>();
  if (companyIds.length === 0) return out;
  const db = await getDb();
  const rows = await db.select({
    phone: s.phoneNumbers,
    dials: sql<number>`count(${s.callLog.id})::int`,
    bad: sql<number>`count(*) filter (where ${s.callLog.outcome} = 'bad_number')::int`,
    gatekeeper: sql<number>`count(*) filter (where ${s.callLog.outcome} = 'gatekeeper')::int`,
    reached: sql<number>`count(*) filter (where ${s.callLog.outcome} in ('connected','meeting_booked','email_requested'))::int`,
  }).from(s.phoneNumbers).leftJoin(s.callLog, eq(s.callLog.phoneNumberId, s.phoneNumbers.id))
    .where(inArray(s.phoneNumbers.companyId, companyIds)).groupBy(s.phoneNumbers.id).orderBy(s.phoneNumbers.id);
  for (const r of rows) {
    const list = out.get(r.phone.companyId!) ?? [];
    list.push({ ...r.phone, dials: r.dials, bad: r.bad, gatekeeper: r.gatekeeper, reached: r.reached });
    out.set(r.phone.companyId!, list);
  }
  return out;
}

/** What one outcome teaches us about the number that was dialed. */
export function phoneStatusAfter(outcome: string): s.PhoneStatus | null {
  if (outcome === "bad_number") return "bad";
  if (outcome === "do_not_contact") return "do_not_call";
  // A voicemail or no answer proves nothing about the line. Only a person picking up does.
  if (outcome === "no_answer" || outcome === "voicemail" || outcome === "other") return null;
  return "good";
}

export async function setPhoneStatus(phoneId: number, status: s.PhoneStatus) {
  await (await getDb()).update(s.phoneNumbers).set({ status }).where(eq(s.phoneNumbers.id, phoneId));
}
