/**
 * Routines are the recurring jobs Claude runs (daily posts search, weekly call-list refresh...).
 * Each is a Markdown file in routines/: a few header lines, then the instructions Claude follows.
 * They are the app's own copies, written to save into this app; the original skills are untouched.
 */
import fs from "node:fs";
import path from "node:path";
import { queueJob } from "./index";

export type Routine = { id: string; name: string; schedule: string; summary: string; basedOn: string; prompt: string };

const DIR = path.join(process.cwd(), "routines");

export function listRoutines(): Routine[] {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR).filter((f) => f.endsWith(".md")).sort().map((file) => {
    const text = fs.readFileSync(path.join(DIR, file), "utf8");
    const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    const meta = Object.fromEntries((m?.[1] ?? "").split("\n").filter((l) => l.includes(": ")).map((l) => [l.slice(0, l.indexOf(": ")), l.slice(l.indexOf(": ") + 2).trim()])) as Record<string, string>;
    return { id: file.replace(/^\d+-|\.md$/g, ""), name: meta.name ?? file, schedule: meta.schedule ?? "On demand", summary: meta.summary ?? "", basedOn: meta.based_on ?? "", prompt: (m?.[2] ?? text).trim() };
  });
}

export const getRoutine = (id: string) => listRoutines().find((r) => r.id === id);

export async function queueRoutineRun(id: string) {
  const routine = getRoutine(id);
  if (!routine) throw new Error(`No routine named ${id}`);
  return queueJob({ kind: `routine:${id}`, title: `Run: ${routine.name}`, payload: { routine: id } });
}
