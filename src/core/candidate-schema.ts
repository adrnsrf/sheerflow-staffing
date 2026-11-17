/**
 * The candidate profile: a resume as structured data. One JSON document per candidate, stored
 * in candidate_profiles.profile. Everything the app shows, scores or searches about a candidate
 * comes from this shape.
 *
 * Two rules keep it honest:
 *  - Facts that vary in reliability carry where they came from (`source`) and whether the
 *    candidate said it or we worked it out (`confidence`).
 *  - A field we do not know is left out, never guessed. `completeness()` reports what is missing
 *    and which intake step would fill it.
 */
import { z } from "zod";

/** Where a fact came from. */
export const SOURCES = ["linkedin", "resume", "application", "screen_call", "conversation", "recruiter_note"] as const;
export type Source = (typeof SOURCES)[number];
export const SOURCE_LABEL: Record<Source, string> = { linkedin: "LinkedIn profile", resume: "Resume", application: "Job application", screen_call: "Screen call", conversation: "Messages", recruiter_note: "Recruiter note" };

const source = z.enum(SOURCES);
const confidence = z.enum(["stated", "inferred"]);
export const COMPANY_SIZES = ["startup", "small", "mid", "large", "enterprise"] as const;
export const SIZE_LABEL: Record<(typeof COMPANY_SIZES)[number], string> = { startup: "Startup (under 50)", small: "Small (50 to 200)", mid: "Mid-size (200 to 1,000)", large: "Large (1,000 to 10,000)", enterprise: "Enterprise (10,000+)" };

/**
 * Personality, as eight scales. Each runs from 1 (the left description) to 5 (the right one);
 * 3 is in between. Neither end is better: they describe fit, and a role can ask for either.
 * A scale is only filled in when there is something to base it on, and it says what.
 */
export const DIMENSIONS = [
  { key: "scope", label: "Breadth", low: "Jack of all trades", high: "Deep specialist", ask: "Do you prefer owning a bit of everything, or going deep on one area?" },
  { key: "structure", label: "Structure", low: "Thrives in ambiguity", high: "Wants clear process", ask: "Tell me about a time nobody told you what to build. How did that feel?" },
  { key: "pace", label: "Pace", low: "Laid back, steady", high: "Driven, intense", ask: "What does a good week look like for you?" },
  { key: "demeanor", label: "Demeanor", low: "Light, easygoing", high: "Serious, formal", ask: "Judged from how they talk; no question needed." },
  { key: "confidence", label: "Confidence", low: "Reserved, understated", high: "Confident, assertive", ask: "Judged from how they describe their own work and push back." },
  { key: "teamwork", label: "Working style", low: "Independent", high: "Collaborative", ask: "Do you do your best work alone or with others in the room?" },
  { key: "audience", label: "Audience", low: "Best with engineers", high: "Best with business people", ask: "Who do you spend most of your day talking to, and who do you enjoy most?" },
  { key: "leadership", label: "Leadership", low: "Hands-on individual", high: "Leads people", ask: "Do you want to manage people, now or later?" },
] as const;
export type DimensionKey = (typeof DIMENSIONS)[number]["key"];
const DIMENSION_KEYS = DIMENSIONS.map((d) => d.key) as [DimensionKey, ...DimensionKey[]];
/** How a value on a scale reads in words. */
export function describeDimension(key: DimensionKey, value: number) {
  const d = DIMENSIONS.find((x) => x.key === key)!;
  return value <= 1.5 ? d.low : value <= 2.5 ? `Leans ${d.low.toLowerCase()}` : value < 3.5 ? `Between ${d.low.toLowerCase()} and ${d.high.toLowerCase()}` : value < 4.5 ? `Leans ${d.high.toLowerCase()}` : d.high;
}

const personalitySchema = z.object({
  dimensions: z.partialRecord(z.enum(DIMENSION_KEYS), z.object({ value: z.number().min(1).max(5), evidence: z.string().optional(), source: z.enum(SOURCES).optional(), confidence: z.enum(["stated", "inferred"]).optional() })).default({}),
  /** Things they brought up themselves and enjoy talking about. For rapport, never for scoring. */
  interests: z.array(z.string()).default([]),
  notes: z.string().optional(),
});
export type Personality = z.infer<typeof personalitySchema>;
const NO_PERSONALITY: Personality = { dimensions: {}, interests: [] };
/** Profiles saved before this section existed have none; treat that as empty. */
export const personalityOf = (p: { personality?: Personality }): Personality => p.personality ?? NO_PERSONALITY;

export const profileSchema = z.object({
  headline: z.string().optional(),
  summary: z.string().optional(),
  totalYears: z.number().optional(),
  targetRoles: z.array(z.string()).default([]),
  location: z.object({ city: z.string().optional(), state: z.string().optional(), workplace: z.enum(["remote", "hybrid", "onsite", "any"]).optional(), willRelocate: z.boolean().optional() }).default({}),
  workAuthorization: z.string().optional(),
  compensation: z.object({ currentBase: z.number().optional(), targetBase: z.number().optional(), minimumBase: z.number().optional(), notes: z.string().optional() }).default({}),
  availability: z.object({ status: z.enum(["active", "passive", "not_looking"]).optional(), noticeWeeks: z.number().optional() }).default({}),
  /** One entry per tool, with years of hands-on use. The heart of matching. */
  skills: z.array(z.object({
    name: z.string(), category: z.enum(["language", "warehouse", "cloud", "processing", "orchestration", "transformation", "streaming", "bi", "ml", "other"]).default("other"),
    years: z.number(), lastUsedYear: z.number().optional(), level: z.enum(["expert", "strong", "working"]).optional(), source: source.optional(), confidence: confidence.optional(),
  })).default([]),
  experience: z.array(z.object({
    company: z.string(), companySize: z.enum(COMPANY_SIZES).optional(), industry: z.string().optional(), title: z.string(), start: z.string(), end: z.string().nullable().optional(),
    teamSize: z.number().optional(), responsibilities: z.array(z.string()).default([]), achievements: z.array(z.string()).default([]), tools: z.array(z.string()).default([]),
  })).default([]),
  education: z.array(z.object({ school: z.string(), degree: z.string().optional(), field: z.string().optional(), year: z.number().optional() })).default([]),
  certifications: z.array(z.string()).default([]),
  /** How they work and what they want. Mostly learned in conversation, so every trait says where it came from. */
  workStyle: z.object({
    traits: z.array(z.object({ trait: z.string(), evidence: z.string().optional(), source: source.optional() })).default([]),
    prefersCompanySize: z.array(z.enum(COMPANY_SIZES)).default([]),
    motivators: z.array(z.string()).default([]),
    concerns: z.array(z.string()).default([]),
    communication: z.string().optional(),
  }).default({ traits: [], prefersCompanySize: [], motivators: [], concerns: [] }),
  /** Personality on fixed scales, plus interests. Sparse by design: filled in from screen calls and by hand. */
  personality: personalitySchema.default(NO_PERSONALITY),
  /** The result of a screen: a Retell AI call or a call with Adrian. */
  screening: z.object({ date: z.string().optional(), by: z.enum(["retell_ai", "recruiter"]).optional(), summary: z.string().optional(), strengths: z.array(z.string()).default([]), risks: z.array(z.string()).default([]) }).optional(),
});
export type Profile = z.infer<typeof profileSchema>;

// ---- Tool names: one canonical spelling, so "AWS Glue", "Amazon Web Services" and "aws" line up.
const TOOLS: [string, RegExp][] = [
  ["Snowflake", /snowflake/i], ["Databricks", /databricks/i], ["BigQuery", /big ?query/i], ["Redshift", /redshift/i], ["Azure Synapse", /synapse/i], ["Microsoft Fabric", /\bfabric\b/i],
  ["Azure Data Factory", /data factory|\badf\b/i], ["Azure", /\bazure\b/i], ["AWS", /\baws\b|amazon web services/i], ["GCP", /\bgcp\b|google cloud/i],
  ["dbt", /\bdbt\b/i], ["Airflow", /airflow/i], ["Dagster", /dagster/i], ["Spark", /spark\b/i], ["Kafka", /kafka/i], ["Fivetran", /fivetran/i], ["Python", /python/i], ["SQL", /\bsql\b/i], ["Scala", /\bscala\b/i],
  ["Power BI", /power ?bi/i], ["Tableau", /tableau/i], ["Looker", /looker/i], ["Sigma", /\bsigma\b/i], ["Terraform", /terraform/i], ["Kubernetes", /kubernetes|\bk8s\b/i], ["SQL Server", /sql server|\bssis\b|\bssas\b/i],
  ["Delta Lake", /delta lake/i], ["AWS Glue", /\bglue\b/i], ["Kinesis", /kinesis/i], ["Flink", /flink/i], ["scikit-learn", /scikit|sklearn/i], ["MLflow", /mlflow/i],
];
export const KNOWN_TOOLS = TOOLS.map(([name]) => name);
/** Every known tool named in a piece of text. A specific tool also implies its platform (AWS Glue means AWS). */
export function toolsIn(text: string): string[] {
  const found = new Set(TOOLS.filter(([, re]) => re.test(text)).map(([name]) => name));
  if (found.has("AWS Glue") || found.has("Redshift") || found.has("Kinesis")) found.add("AWS");
  if (found.has("Azure Synapse") || found.has("Azure Data Factory") || found.has("Microsoft Fabric")) found.add("Azure");
  if (found.has("BigQuery")) found.add("GCP");
  if (found.has("SQL Server")) found.add("SQL");
  return [...found];
}
export const canonTool = (name: string) => TOOLS.find(([, re]) => re.test(name))?.[0] ?? name.trim();

/** Years of hands-on use per canonical tool, taking the longest claim when a tool appears twice. */
export function toolYears(p: Profile): Map<string, number> {
  const m = new Map<string, number>();
  for (const sk of p.skills) for (const t of new Set([canonTool(sk.name), ...toolsIn(sk.name)])) m.set(t, Math.max(m.get(t) ?? 0, sk.years));
  return m;
}

/** The profile as plain prose. This is what gets embedded for vector search: what they did, with what, where, and how they work. */
export function profileText(name: string, p: Profile): string {
  const parts: string[] = [];
  if (p.headline) parts.push(p.headline + ".");
  if (p.summary) parts.push(p.summary);
  if (p.totalYears) parts.push(`${p.totalYears} years of experience.`);
  if (p.skills.length) parts.push("Tools: " + [...p.skills].sort((a, b) => b.years - a.years).map((s) => `${s.name} (${s.years} years)`).join(", ") + ".");
  for (const e of p.experience.slice(0, 4)) {
    parts.push(`${e.title} at a ${e.companySize ? SIZE_LABEL[e.companySize].split(" (")[0].toLowerCase() : ""} ${e.industry ?? ""} company. ${e.responsibilities.join(" ")} ${e.achievements.join(" ")}`.replace(/\s+/g, " "));
  }
  if (p.workStyle.traits.length) parts.push("Work style: " + p.workStyle.traits.map((t) => t.trait).join("; ") + ".");
  if (p.workStyle.prefersCompanySize.length) parts.push("Prefers " + p.workStyle.prefersCompanySize.map((s) => SIZE_LABEL[s].split(" (")[0].toLowerCase()).join(" or ") + " companies.");
  if (p.workStyle.motivators.length) parts.push("Wants: " + p.workStyle.motivators.join("; ") + ".");
  if (p.certifications.length) parts.push("Certifications: " + p.certifications.join(", ") + ".");
  return parts.join(" ").trim() || name;
}

/** The profile cut into parts, each embedded separately for search. */
export function profileChunks(p: Profile): { kind: "summary" | "tools" | "experience" | "work_style"; content: string }[] {
  const out: { kind: "summary" | "tools" | "experience" | "work_style"; content: string }[] = [];
  const size = (x?: (typeof COMPANY_SIZES)[number]) => (x ? SIZE_LABEL[x].split(" (")[0].toLowerCase() : "");
  const summary = [p.headline, p.summary, p.targetRoles.length ? `Looking for: ${p.targetRoles.join(", ")}.` : ""].filter(Boolean).join(" ");
  if (summary) out.push({ kind: "summary", content: summary });
  if (p.skills.length) out.push({ kind: "tools", content: [...p.skills].sort((a, b) => b.years - a.years).map((s) => `${s.years} years of ${s.name}`).join(", ") + (p.certifications.length ? `. Certified: ${p.certifications.join(", ")}` : "") });
  for (const e of p.experience) {
    const body = [...e.responsibilities, ...e.achievements].join(" ");
    if (body) out.push({ kind: "experience", content: `${e.title} at a ${size(e.companySize)} ${e.industry ?? ""} company${e.teamSize ? `, team of ${e.teamSize}` : ""}. ${body}`.replace(/\s+/g, " ") });
  }
  const style = [...p.workStyle.traits.map((t) => `${t.trait}. ${t.evidence ?? ""}`), p.workStyle.motivators.length ? `Wants ${p.workStyle.motivators.join("; ")}.` : "", p.workStyle.concerns.length ? `Wants to avoid ${p.workStyle.concerns.join("; ")}.` : "",
    p.workStyle.prefersCompanySize.length ? `Prefers ${p.workStyle.prefersCompanySize.map(size).join(" or ")} companies.` : "", p.workStyle.communication ?? "", p.screening?.summary ?? "",
    ...Object.entries(personalityOf(p).dimensions).map(([k, d]) => `${describeDimension(k as DimensionKey, d!.value)}.`), personalityOf(p).interests.length ? `Interests: ${personalityOf(p).interests.join(", ")}.` : ""].filter(Boolean).join(" ");
  if (style) out.push({ kind: "work_style", content: style });
  return out;
}

/** What is still unknown about a candidate, and which intake step usually supplies it. */
const CHECKS: [string, (p: Profile) => boolean, string, number][] = [
  ["Work history with responsibilities", (p) => p.experience.some((e) => e.responsibilities.length > 0), "LinkedIn profile or resume", 20],
  ["Tools with years of use", (p) => p.skills.length >= 3, "Resume gives the tools; the screen call confirms years on each", 20],
  ["Years confirmed in a conversation", (p) => p.skills.some((s) => s.source === "screen_call" || s.source === "conversation" || s.source === "application"), "Screen call: ask years and last use for each must-have tool", 10],
  ["Location and remote preference", (p) => !!p.location.workplace && !!(p.location.city || p.location.state), "Application form or screen call", 10],
  ["Target pay", (p) => p.compensation.targetBase != null || p.compensation.minimumBase != null, "Application form or screen call", 10],
  ["Availability and notice", (p) => !!p.availability.status, "Application form or screen call", 5],
  ["Work authorization", (p) => !!p.workAuthorization, "Application form", 5],
  ["Work style and what they want", (p) => p.workStyle.traits.length > 0 || p.workStyle.motivators.length > 0, "Screen call or messages", 10],
  ["Personality (at least 4 of the 8 scales)", (p) => Object.keys(personalityOf(p).dimensions).length >= 4, "Screen call, or fill it in by hand after talking to them", 10],
  ["Company size they have worked in", (p) => p.experience.some((e) => !!e.companySize), "Worked out from employers on the resume", 5],
  ["Screen summary", (p) => !!p.screening?.summary, "Retell AI screen call or a call with you", 5],
];
export function completeness(p: Profile) {
  const missing = CHECKS.filter(([, ok]) => !ok(p)).map(([field, , fill]) => ({ field, fill }));
  const total = CHECKS.reduce((n, c) => n + c[3], 0);
  const score = Math.round((100 * CHECKS.filter(([, ok]) => ok(p)).reduce((n, c) => n + c[3], 0)) / total);
  return { score, missing };
}
