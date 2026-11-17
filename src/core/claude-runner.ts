/**
 * "Run Claude now": starts Claude Code on this computer, pointed at this app, to work the job
 * queue. It uses the Claude account Claude Code is signed in to, so there is no API key and no
 * per-use bill. The run happens in the background; the Claude screen shows when it finishes
 * and what it did.
 *
 * What the run may touch is a short allow-list: this app's own tools, and web search for
 * research. It is not given tools that send email, post, or spend credits. Add read-only tools
 * from other connections (Gmail search, Apollo lookups) with CLAUDE_EXTRA_TOOLS in .env.local.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";

const MAX_JOBS = 10;
const MAX_MINUTES = 20;

const PROMPT = `You are working the SheerFlow job queue. Use only the sheerflow tools, plus web search where a job calls for research.
1. Call get_context with slug "ground-rules" and follow it.
2. Call list_jobs. Work the queued jobs oldest first, at most ${MAX_JOBS} in this run.
3. For each job: read the skill or routine that fits it (list_context shows them; a job whose kind starts with "routine:" names its routine), do the work with the tools, save the result in the app, then call complete_job with one or two plain sentences on what you did. If you cannot do a job with the tools you have, call complete_job with failed=true and say exactly what was missing.
4. Never send, post, connect or spend. Never invent facts about a person or company.
When done, reply with a short plain summary: how many jobs you finished, how many you could not do and why.`;

export function claudeInstalled() {
  try { return spawnSync(process.platform === "win32" ? "where" : "which", ["claude"], { encoding: "utf8" }).status === 0; } catch { return false; }
}

export async function currentRun() {
  const db = await getDb();
  const [run] = await db.select().from(s.claudeRuns).orderBy(desc(s.claudeRuns.id)).limit(1);
  // A run still marked as running after the time limit was cut off (for example the app restarted).
  if (run?.status === "running" && Date.now() - run.startedAt.getTime() > (MAX_MINUTES + 2) * 60_000) {
    await db.update(s.claudeRuns).set({ status: "failed", summary: "The run did not report back. It may have been cut off when the app restarted.", finishedAt: new Date() }).where(eq(s.claudeRuns.id, run.id));
    return { ...run, status: "failed" as const };
  }
  return run ?? null;
}

export const listRuns = async () => (await getDb()).select().from(s.claudeRuns).orderBy(desc(s.claudeRuns.id)).limit(8);

/** Start a run. `origin` is where this app is reachable, e.g. http://localhost:3000. */
export async function startClaudeRun(origin: string, startedBy = "button") {
  const db = await getDb();
  if (!claudeInstalled()) throw new Error("Claude Code is not installed on this computer, so the app cannot start a run. Install it from claude.com/claude-code and sign in, or work the queue from a Claude session connected to this app.");
  const running = await currentRun();
  if (running?.status === "running") return running;
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.jobs).where(eq(s.jobs.status, "queued"));
  if (n === 0) throw new Error("There is nothing waiting for Claude.");
  const [run] = await db.insert(s.claudeRuns).values({ jobsWaiting: n, startedBy }).returning();

  const dir = path.join(process.cwd(), ".data");
  fs.mkdirSync(dir, { recursive: true });
  const config = path.join(dir, "claude-mcp.json");
  fs.writeFileSync(config, JSON.stringify({ mcpServers: { sheerflow: { type: "http", url: `${origin}/api/mcp` } } }));
  const tools = ["mcp__sheerflow", "WebSearch", "WebFetch", ...(process.env.CLAUDE_EXTRA_TOOLS ?? "").split(",").map((x) => x.trim()).filter(Boolean)];
  const child = spawn("claude", ["-p", PROMPT, "--mcp-config", config, "--allowedTools", ...tools], { cwd: dir, stdio: ["ignore", "pipe", "pipe"], env: process.env });
  let out = "", err = "";
  child.stdout.on("data", (d) => { out = (out + d).slice(-8000); });
  child.stderr.on("data", (d) => { err = (err + d).slice(-2000); });
  const timer = setTimeout(() => child.kill(), MAX_MINUTES * 60_000);
  const finish = async (ok: boolean, note?: string) => {
    clearTimeout(timer);
    const [{ left }] = await db.select({ left: sql<number>`count(*)::int` }).from(s.jobs).where(eq(s.jobs.status, "queued"));
    await db.update(s.claudeRuns).set({ status: ok ? "finished" : "failed", jobsDone: Math.max(0, n - left), summary: (out.trim() || note || err.trim() || "No output").slice(-4000), finishedAt: new Date() }).where(eq(s.claudeRuns.id, run.id));
  };
  child.on("error", (e) => void finish(false, `Could not start Claude Code: ${e.message}`));
  child.on("close", (code) => void finish(code === 0, code === 0 ? undefined : `Claude Code stopped early (code ${code}). ${err.trim().slice(-400)}`));
  return run;
}
