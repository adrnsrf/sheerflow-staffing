/**
 * Apollo connector. Live when APOLLO_API_KEY is set (in .env.local); otherwise the
 * app stays in sample mode. Only read calls that cost no credits live here. Anything
 * that spends credits (reveals, enrichment, net-new company search) is deliberately
 * absent: those stay behind an approval in a Claude run.
 */

const BASE = "https://api.apollo.io/api/v1";

export const apolloConfigured = () => !!process.env.APOLLO_API_KEY;

export class ApolloError extends Error {}

async function apollo<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  if (!apolloConfigured()) throw new ApolloError("Apollo is not connected. Add APOLLO_API_KEY to .env.local and restart the app.");
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: init.method ?? "GET",
      headers: { "X-Api-Key": process.env.APOLLO_API_KEY!, "Content-Type": "application/json", "Cache-Control": "no-cache" },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    throw new ApolloError(`Could not reach Apollo: ${e instanceof Error ? (e.cause instanceof Error ? e.cause.message : e.message) : String(e)}`);
  }
  const text = await res.text();
  if (!res.ok) {
    const hint = res.status === 401 ? " The API key was rejected." : res.status === 403 ? " This endpoint needs a master API key." : res.status === 429 ? " Rate limit reached; try again in a minute." : "";
    throw new ApolloError(`Apollo answered ${res.status}.${hint} ${text.slice(0, 200)}`);
  }
  return JSON.parse(text) as T;
}

/** Cheapest possible read: is the key accepted? */
export async function apolloHealth() {
  const r = await apollo<{ healthy?: boolean; is_logged_in?: boolean }>("/auth/health");
  return { ok: !!(r.is_logged_in ?? r.healthy), raw: r };
}

export type ApolloList = { id: string; name: string; modality: "contacts" | "accounts" | string; count: number };

/** The team's saved lists (Apollo calls them labels). 0 credits. */
export async function apolloLists(): Promise<ApolloList[]> {
  const r = await apollo<unknown>("/labels");
  const rows = (Array.isArray(r) ? r : ((r as { labels?: unknown[]; data?: unknown[] }).labels ?? (r as { data?: unknown[] }).data ?? [])) as Record<string, unknown>[];
  return rows.map((l) => ({ id: String(l.id ?? l._id), name: String(l.name), modality: String(l.modality), count: Number(l.cached_count ?? 0) }))
    .sort((a, b) => b.count - a.count);
}

export type ApolloAccount = { apolloId: string; name: string; domain: string | null; website: string | null; phone: string | null; location: string | null; employees: number | null; industry: string | null };

/** Saved accounts on one list. Searches only the team's own accounts, so 0 credits. */
export async function apolloAccountsInList(listId: string, page = 1, perPage = 25): Promise<{ accounts: ApolloAccount[]; total: number; page: number; totalPages: number }> {
  const r = await apollo<{ accounts?: Record<string, unknown>[]; pagination?: { total_entries?: number; total_pages?: number; page?: number } }>("/accounts/search", {
    method: "POST", body: { label_ids: [listId], page, per_page: perPage },
  });
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const accounts = (r.accounts ?? []).map((a) => {
    const org = (a.organization ?? {}) as Record<string, unknown>;
    const place = [str(a.organization_city) ?? str(org.city), str(a.organization_state) ?? str(org.state)].filter(Boolean).join(", ");
    return {
      apolloId: String(a.organization_id ?? a.id), name: String(a.name ?? org.name ?? "Unknown"),
      domain: str(a.domain) ?? str(a.primary_domain) ?? str(org.primary_domain), website: str(a.website_url) ?? str(org.website_url),
      phone: str(a.phone) ?? str(a.sanitized_phone) ?? str(org.phone), location: place || null,
      employees: Number(a.estimated_num_employees ?? org.estimated_num_employees) || null, industry: str(a.industry) ?? str(org.industry),
    };
  });
  return { accounts, total: r.pagination?.total_entries ?? accounts.length, page: r.pagination?.page ?? page, totalPages: r.pagination?.total_pages ?? 1 };
}
