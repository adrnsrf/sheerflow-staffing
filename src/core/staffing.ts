/**
 * The staffing archive: a running list of staffing firms, recruiters and job boards.
 * SheerFlow never prospects them, so anything that arrives under one of these names is dropped
 * and the firm's "times seen" goes up. New names that look like staffing firms are added as
 * "suspected"; you confirm them or mark them "not staffing" on the Staffing firms screen.
 */
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";

export const staffingKey = (name: string) =>
  name.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").replace(/\b(inc|llc|ltd|corp|corporation|co|company|group|the)\b/g, " ").replace(/\s+/g, " ").trim();

/** Words that mark a firm that places people or re-posts jobs. Deliberately narrow: "consulting" and "solutions" are not here. */
const PATTERN = /staffing|recruit|talent|workforce|headhunt|\bjobs?\b|job ?(feed|board|let)|hunter\b|placement|search (group|partners)|\brpo\b|resourcing/i;

/** Firms already known when the app starts. Add to this in the app, not here. */
export const KNOWN_FIRMS = [
  "RemoteHunter", "Superworq", "Joblet-AI", "Ladders", "Swooped", "Torentify", "TalentHop", "GlobalJobFeed", "RecruiterForge", "Franklin Fitch",
  "Jobot", "Dice", "Lensa", "Robert Half", "TEKsystems", "Randstad", "Adecco", "Kforce", "Insight Global", "Motion Recruitment", "Harnham", "Aerotek", "Apex Systems", "CyberCoders", "Hays",
];

/**
 * Is this company a staffing firm? Checks the archive first, then the name pattern.
 * A pattern match is added to the archive as "suspected" so it can be reviewed.
 */
export async function checkStaffing(name: string, source: string): Promise<boolean> {
  const db = await getDb();
  const key = staffingKey(name);
  if (!key) return false;
  const [known] = await db.select().from(s.staffingFirms).where(eq(s.staffingFirms.nameKey, key));
  if (known) {
    await db.update(s.staffingFirms).set({ timesSeen: sql`${s.staffingFirms.timesSeen} + 1`, lastSeenAt: new Date() }).where(eq(s.staffingFirms.id, known.id));
    return known.status !== "not_staffing";
  }
  if (!PATTERN.test(name)) return false;
  await db.insert(s.staffingFirms).values({ name: name.trim(), nameKey: key, status: "suspected", source, note: "Added because of its name. Confirm or mark as not staffing." });
  return true;
}

/** Add a firm to the archive, or change the status of one already there. */
export async function addStaffingFirm(input: { name: string; domain?: string; status?: s.StaffingStatus; source: string; note?: string }) {
  const db = await getDb();
  const key = staffingKey(input.name);
  if (!key) throw new Error("A firm needs a name");
  const [existing] = await db.select().from(s.staffingFirms).where(eq(s.staffingFirms.nameKey, key));
  if (existing) {
    const [firm] = await db.update(s.staffingFirms).set({ status: input.status ?? "confirmed", note: input.note ?? existing.note, domain: input.domain ?? existing.domain, lastSeenAt: new Date() }).where(eq(s.staffingFirms.id, existing.id)).returning();
    return { firm, created: false };
  }
  const [firm] = await db.insert(s.staffingFirms).values({ name: input.name.trim(), nameKey: key, domain: input.domain, status: input.status ?? "confirmed", source: input.source, note: input.note }).returning();
  return { firm, created: true };
}

export async function listStaffingFirms() {
  return (await getDb()).select().from(s.staffingFirms).orderBy(desc(s.staffingFirms.lastSeenAt), s.staffingFirms.name);
}

export async function setStaffingStatus(id: number, status: s.StaffingStatus) {
  await (await getDb()).update(s.staffingFirms).set({ status }).where(eq(s.staffingFirms.id, id));
}

/** Check a batch of names without changing anything except the archive's "seen" counts. Used by Claude runs. */
export async function checkStaffingNames(names: string[], source: string) {
  const out: { name: string; staffing: boolean }[] = [];
  for (const name of names) out.push({ name, staffing: await checkStaffing(name, source) });
  return out;
}
