/**
 * Backup and restore: the whole app as one file. Use it to keep a copy, or to move work from
 * one computer to another (for example results Claude produced elsewhere).
 *
 * Search vectors are left out of the file because they can be rebuilt; restore rebuilds them.
 */
import { getTableColumns, getTableName, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { saveCandidateProfile } from "./candidates";
import { embedRole } from "./matching";

// Parents before children, so rows can be put back in this order.
const TABLES: PgTable[] = [
  s.users, s.companies, s.people, s.phoneNumbers, s.signals, s.callQueue, s.callLog, s.searches, s.activities, s.tasks, s.deals, s.drafts,
  s.candidateProfiles, s.candidateSources, s.searchCandidates, s.screenCalls, s.agreements, s.placements, s.jobPostings, s.staffingFirms,
  s.apolloIntent, s.signalTypes, s.contextDocs, s.jobs, s.claudeRuns, s.creditLedger, s.settings,
];
const SKIP_COLUMNS = new Set(["embedding"]);

export async function exportBackup() {
  const db = await getDb();
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const table of TABLES) {
    const rows = (await db.select().from(table)) as Record<string, unknown>[];
    tables[getTableName(table)] = rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !SKIP_COLUMNS.has(k))));
  }
  return { app: "sheerflow", version: 1, exportedAt: new Date().toISOString(), counts: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])), tables };
}

/** Replace everything in the app with the contents of a backup file. */
export async function restoreBackup(file: unknown) {
  const backup = file as { app?: string; tables?: Record<string, Record<string, unknown>[]> };
  if (backup?.app !== "sheerflow" || !backup.tables) throw new Error("That file is not a SheerFlow backup.");
  const db = await getDb();
  let rows = 0;
  // All or nothing: if anything in the file cannot be put back, the app is left exactly as it was.
  await db.transaction(async (tx) => {
    await tx.delete(s.candidateChunks);
    for (const table of [...TABLES].reverse()) await tx.delete(table);
    for (const table of TABLES) {
      const name = getTableName(table);
      const cols = getTableColumns(table);
      const byName = Object.fromEntries(Object.entries(cols).map(([key, col]) => [key, col]));
      const data = (backup.tables![name] ?? []).map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k in byName).map(([k, v]) => [k, byName[k].dataType === "date" && typeof v === "string" ? new Date(v) : v])));
      for (let i = 0; i < data.length; i += 200) await tx.insert(table).values(data.slice(i, i + 200) as never);
      rows += data.length;
      // Rows came in with their own ids; move the id counter past them.
      if ("id" in byName && byName.id.columnType === "PgSerial") await tx.execute(sql.raw(`select setval(pg_get_serial_sequence('${name}', 'id'), coalesce((select max(id) from ${name}), 0) + 1, false)`));
    }
  });
  // Rebuild what was left out of the file: search vectors for candidates and roles.
  for (const c of await db.select().from(s.candidateProfiles)) await saveCandidateProfile(c.personId, c.profile, { isSample: c.isSample });
  for (const r of await db.select({ id: s.searches.id }).from(s.searches)) await embedRole(r.id);
  return { tables: TABLES.length, rows };
}
