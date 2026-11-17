/**
 * Retell AI: places an AI screen call to a candidate and returns the transcript.
 * Live when RETELL_API_KEY, RETELL_AGENT_ID and RETELL_FROM_NUMBER are set in .env.local.
 *
 * NOT YET RUN AGAINST RETELL. The request shapes follow Retell's v2 API as documented
 * (create-phone-call, get-call); expect to adjust field names on first live use.
 */
const BASE = "https://api.retellai.com";

export const retellConfigured = () => !!(process.env.RETELL_API_KEY && process.env.RETELL_AGENT_ID && process.env.RETELL_FROM_NUMBER);

export class RetellError extends Error {}

async function retell<T>(path: string, init: { method: "GET" | "POST"; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, { method: init.method, headers: { Authorization: `Bearer ${process.env.RETELL_API_KEY}`, "Content-Type": "application/json" }, body: init.body ? JSON.stringify(init.body) : undefined, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  } catch (e) { throw new RetellError(`Could not reach Retell: ${e instanceof Error ? e.message : String(e)}`); }
  const text = await res.text();
  if (!res.ok) throw new RetellError(`Retell answered ${res.status}. ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

/** E.164 form Retell expects: +1 and ten digits for US numbers. */
export function toE164(phone: string) {
  const d = phone.replace(/\D/g, "");
  return d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith("1") ? `+${d}` : phone.trim().startsWith("+") ? `+${d}` : null;
}

/** Start a call. `brief` is handed to the agent as variables it can use in its script. */
export async function startScreenCall(toNumber: string, brief: Record<string, string>) {
  const r = await retell<{ call_id: string; call_status?: string }>("/v2/create-phone-call", {
    method: "POST", body: { from_number: process.env.RETELL_FROM_NUMBER, to_number: toNumber, override_agent_id: process.env.RETELL_AGENT_ID, retell_llm_dynamic_variables: brief },
  });
  return { callId: r.call_id, status: r.call_status ?? "registered" };
}

/** Where a call stands and, once it has ended, what was said. */
export async function getScreenCall(callId: string) {
  const r = await retell<{ call_status?: string; transcript?: string; call_analysis?: { call_summary?: string } }>(`/v2/get-call/${callId}`, { method: "GET" });
  return { status: r.call_status ?? "unknown", transcript: r.transcript ?? null, summary: r.call_analysis?.call_summary ?? null };
}
