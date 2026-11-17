import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";
import { seed } from "./seed";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

// One connection per process, kept across hot reloads. The database is a folder on disk
// (.data/pglite); delete it (npm run db:reset) to start again from the sample data.
const holder = globalThis as unknown as { __sheerflowDb?: Promise<Db> };

async function init(): Promise<Db> {
  const dir = process.env.SHEERFLOW_DATA_DIR ?? path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dir, { recursive: true });
  const db = drizzle(new PGlite(dir), { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  const [{ n }] = await db.select({ n: count() }).from(schema.users);
  if (n === 0) await seed(db);
  return db;
}

export function getDb(): Promise<Db> {
  return (holder.__sheerflowDb ??= init());
}
