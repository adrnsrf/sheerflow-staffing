/**
 * The AI context store: the instructions Claude reads before it works in this app.
 *  - routines are jobs that can be queued (daily posts search, weekly call-list refresh...)
 *  - skills are standing guidance (ground rules, how to log a call, how to spot a staffing firm)
 *
 * Defaults ship as Markdown in the context/ folder and are copied into the database on start.
 * From then on the database is the truth: edit a doc in the app and your version is kept, even
 * when the shipped file later changes. Claude can read the store but cannot write to it.
 */
import fs from "node:fs";
import path from "node:path";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { queueJob } from "./index";

const DIR = path.join(process.cwd(), "context");
type Doc = typeof s.contextDocs.$inferSelect;

function readShipped(): Omit<Doc, "updatedAt" | "edited">[] {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR).filter((f) => f.endsWith(".md")).sort().map((file) => {
    const text = fs.readFileSync(path.join(DIR, file), "utf8");
    const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    const meta = Object.fromEntries((m?.[1] ?? "").split("\n").filter((l) => l.includes(": ")).map((l) => [l.slice(0, l.indexOf(": ")), l.slice(l.indexOf(": ") + 2).trim()])) as Record<string, string>;
    return {
      slug: file.replace(/^\d+-|\.md$/g, ""), kind: (meta.kind === "skill" ? "skill" : "routine") as s.ContextKind, title: meta.name ?? file,
      summary: meta.summary ?? null, schedule: meta.schedule ?? null, basedOn: meta.based_on ?? null, body: (m?.[2] ?? text).trim(), shipped: true,
    };
  });
}

const holder = globalThis as unknown as { __sheerflowContext?: Promise<void> };
/** Copy shipped docs into the database: add missing ones, refresh ones the user has not edited. */
function ready() {
  return (holder.__sheerflowContext ??= (async () => {
    const db = await getDb();
    for (const doc of readShipped()) {
      const [existing] = await db.select().from(s.contextDocs).where(eq(s.contextDocs.slug, doc.slug));
      if (!existing) await db.insert(s.contextDocs).values(doc);
      else if (!existing.edited) await db.update(s.contextDocs).set(doc).where(eq(s.contextDocs.slug, doc.slug));
    }
  })());
}

export async function listContext(kind?: s.ContextKind) {
  await ready();
  const rows = await (await getDb()).select().from(s.contextDocs).orderBy(asc(s.contextDocs.kind), asc(s.contextDocs.title));
  return kind ? rows.filter((r) => r.kind === kind) : rows;
}

export async function getContext(slug: string) {
  await ready();
  return (await (await getDb()).select().from(s.contextDocs).where(eq(s.contextDocs.slug, slug)))[0] ?? null;
}

const toSlug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);

/** Create a doc, or save an edit to one. Edited docs are never replaced by shipped text. */
export async function saveContext(input: { slug?: string; kind: s.ContextKind; title: string; summary?: string; schedule?: string; body: string }) {
  await ready();
  const db = await getDb();
  const slug = input.slug || toSlug(input.title);
  if (!slug || !input.body.trim()) throw new Error("A context doc needs a title and some text");
  const values = { kind: input.kind, title: input.title.trim(), summary: input.summary?.trim() || null, schedule: input.schedule?.trim() || null, body: input.body.trim(), edited: true, updatedAt: new Date() };
  const [existing] = await db.select().from(s.contextDocs).where(eq(s.contextDocs.slug, slug));
  if (existing) await db.update(s.contextDocs).set(values).where(eq(s.contextDocs.slug, slug));
  else await db.insert(s.contextDocs).values({ slug, ...values, shipped: false });
  return slug;
}

/** Put a shipped doc back to the text that came with the app. */
export async function resetContext(slug: string) {
  const shipped = readShipped().find((d) => d.slug === slug);
  if (!shipped) throw new Error("Only docs that came with the app can be reset");
  await (await getDb()).update(s.contextDocs).set({ ...shipped, edited: false, updatedAt: new Date() }).where(eq(s.contextDocs.slug, slug));
}

/** Remove a doc you created. Shipped docs can be edited or reset, not deleted (they would come back on restart). */
export async function deleteContext(slug: string) {
  const doc = await getContext(slug);
  if (doc?.shipped) throw new Error("This doc came with the app. Edit it or reset it instead.");
  await (await getDb()).delete(s.contextDocs).where(eq(s.contextDocs.slug, slug));
}

export async function queueRoutineRun(slug: string) {
  const doc = await getContext(slug);
  if (!doc || doc.kind !== "routine") throw new Error(`No routine named ${slug}`);
  return queueJob({ kind: `routine:${slug}`, title: `Run: ${doc.title}`, payload: { routine: slug } });
}
