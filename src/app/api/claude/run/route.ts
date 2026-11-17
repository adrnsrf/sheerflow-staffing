import { startClaudeRun } from "@/core/claude-runner";

// POST here to start a run from outside the app, for example from a scheduled task:
//   curl -X POST http://localhost:3000/api/claude/run
export async function POST(req: Request) {
  try {
    const run = await startClaudeRun(new URL(req.url).origin, "schedule");
    return Response.json({ started: true, runId: run.id, jobsWaiting: run.jobsWaiting });
  } catch (e) {
    return Response.json({ started: false, reason: e instanceof Error ? e.message : String(e) });
  }
}
