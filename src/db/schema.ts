import { boolean, integer, jsonb, pgTable, serial, text, timestamp, vector } from "drizzle-orm/pg-core";
import type { Profile } from "../core/candidate-schema";
import type { Requirements } from "../core/matching";

/**
 * Shared core. All three workspaces read and write these tables.
 * Dedupe keys: companies.domain, people.linkedinUrl / apolloId, signals.externalId.
 * Plain Postgres, so the same schema moves to Supabase unchanged.
 */

const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export type UserRole = "owner" | "rep" | "vendor";
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").$type<UserRole>().notNull(),
});

export type CompanyStatus = "prospect" | "client" | "do_not_contact";
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  /** Dedupe key when present. Companies that arrive without a website match on name instead. */
  domain: text("domain").unique(),
  website: text("website"),
  industry: text("industry"),
  location: text("location"),
  employees: integer("employees"),
  dataTeamSize: integer("data_team_size"),
  recruitingTeamSize: integer("recruiting_team_size"),
  icpTier: text("icp_tier").$type<"A" | "B" | "C">(),
  icpScore: integer("icp_score"),
  hqPhone: text("hq_phone"),
  altPhones: text("alt_phones"),
  apolloId: text("apollo_id"),
  apolloAccountId: text("apollo_account_id"),
  // Research columns from the call sheet.
  headcountGrowth: text("headcount_growth"),
  keywords: text("keywords"),
  technicalRecruiters: integer("technical_recruiters"),
  avgDataSalaryK: integer("avg_data_salary_k"),
  openDataRoles: integer("open_data_roles"),
  status: text("status").$type<CompanyStatus>().notNull().default("prospect"),
  brief: text("brief"),
  createdAt: created(),
});

export type PersonType = "decision_maker" | "candidate";
export type ConnectionStatus = "none" | "queued" | "note_ready" | "sent" | "connected";
export const people = pgTable("people", {
  id: serial("id").primaryKey(),
  type: text("type").$type<PersonType>().notNull(),
  name: text("name").notNull(),
  title: text("title"),
  companyId: integer("company_id").references(() => companies.id),
  currentEmployer: text("current_employer"),
  location: text("location"),
  linkedinUrl: text("linkedin_url").unique(),
  apolloId: text("apollo_id"),
  apolloContactId: text("apollo_contact_id"),
  email: text("email"),
  phone: text("phone"),
  phoneType: text("phone_type"),
  timeInRole: text("time_in_role"),
  contactRevealed: boolean("contact_revealed").notNull().default(false),
  connectionStatus: text("connection_status").$type<ConnectionStatus>().notNull().default("none"),
  connectionNote: text("connection_note"),
  connectionRequestedAt: timestamp("connection_requested_at", { withTimezone: true }),
  connectedAt: timestamp("connected_at", { withTimezone: true }),
  skills: text("skills"),
  notes: text("notes"),
  createdAt: created(),
});

export type SignalType = "hiring_post" | "job_posting" | "new_leader" | "funding" | "job_alert" | "staffing_intent";
export type SignalStatus = "new" | "kept" | "dismissed" | "promoted";
export const signals = pgTable("signals", {
  id: serial("id").primaryKey(),
  type: text("type").$type<SignalType>().notNull(),
  category: text("category"),
  title: text("title").notNull(),
  summary: text("summary"),
  roles: text("roles"),
  companyId: integer("company_id").references(() => companies.id),
  personId: integer("person_id").references(() => people.id),
  source: text("source").notNull(),
  sourceUrl: text("source_url"),
  externalId: text("external_id").unique(),
  careerVerified: text("career_verified"),
  careerPageLink: text("career_page_link"),
  location: text("location"),
  isUs: text("is_us"),
  searchQuery: text("search_query"),
  foundOn: text("found_on"),
  notes: text("notes"),
  /** The source row exactly as it arrived (sheet columns by header), so nothing is lost while the model settles. */
  raw: jsonb("raw").$type<Record<string, string>>(),
  signalDate: timestamp("signal_date", { withTimezone: true }).notNull(),
  status: text("status").$type<SignalStatus>().notNull().default("new"),
  createdAt: created(),
});

/**
 * Where a call-list row stands. Callers never pick this: it follows from the outcome of the
 * last logged call (see OUTCOME_TO_STATUS in src/core).
 */
export type CallQueueStatus = "new" | "attempting" | "connected" | "meeting_booked" | "needs_info" | "closed" | "do_not_contact";
/** Replaces the DFC call sheet: one row per company a rep is working. */
export const callQueue = pgTable("call_queue", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  personId: integer("person_id").references(() => people.id),
  ownerId: integer("owner_id").references(() => users.id),
  status: text("status").$type<CallQueueStatus>().notNull().default("new"),
  /** Call Status exactly as written in the sheet, kept beside the app's own status. */
  sourceStatus: text("source_status"),
  /** Stable key of the source row (Apollo contact id, LinkedIn URL, or company + name) so re-imports never duplicate. */
  sourceKey: text("source_key").unique(),
  batch: text("batch"),
  meetingBooked: text("meeting_booked"),
  alternateDms: text("alternate_dms"),
  raw: jsonb("raw").$type<Record<string, string>>(),
  topSignal: text("top_signal"),
  lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
  nextStep: text("next_step"),
  nextStepDate: timestamp("next_step_date", { withTimezone: true }),
  notes: text("notes"),
  addedBy: text("added_by"),
  createdAt: created(),
});

export type PhoneKind = "company_main" | "company_office" | "toll_free" | "direct" | "mobile" | "unknown";
export type PhoneSource = "apollo" | "claude_research" | "call_sheet" | "manual";
export type PhoneStatus = "unverified" | "good" | "bad" | "do_not_call";
/**
 * Every phone number we know, one row each: a company line (personId empty) or a person's line.
 * `source` says where it came from; `status` is learned from the call log (a bad-number outcome
 * marks the number bad, not the company).
 */
export const phoneNumbers = pgTable("phone_numbers", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id),
  personId: integer("person_id").references(() => people.id),
  /** As written at the source, for display and dialing. */
  number: text("number").notNull(),
  /** Digits only, without a leading US 1. The match key. */
  digits: text("digits").notNull(),
  kind: text("kind").$type<PhoneKind>().notNull().default("unknown"),
  label: text("label"),
  source: text("source").$type<PhoneSource>().notNull(),
  sourceDetail: text("source_detail"),
  status: text("status").$type<PhoneStatus>().notNull().default("unverified"),
  createdAt: created(),
});

/** What happened on one dial. */
export type CallOutcome = "connected" | "meeting_booked" | "email_requested" | "voicemail" | "no_answer" | "gatekeeper" | "bad_number" | "wrong_person" | "not_interested" | "do_not_contact";
/** One row per dial, tied to the number that was dialed. */
export const callLog = pgTable("call_log", {
  id: serial("id").primaryKey(),
  callQueueId: integer("call_queue_id").references(() => callQueue.id),
  companyId: integer("company_id").references(() => companies.id),
  personId: integer("person_id").references(() => people.id),
  phoneNumberId: integer("phone_number_id").references(() => phoneNumbers.id),
  userId: integer("user_id").references(() => users.id),
  outcome: text("outcome").$type<CallOutcome | "other">().notNull(),
  notes: text("notes"),
  /** "app" for calls logged with the buttons, "call_sheet" for history read out of DFC Notes (outcome guessed from the wording). */
  source: text("source").$type<"app" | "call_sheet">().notNull().default("app"),
  calledAt: timestamp("called_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Touches other than calls: emails, LinkedIn, meetings, notes. Calls live in call_log. */
export type ActivityType = "email" | "linkedin" | "meeting" | "note";
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  type: text("type").$type<ActivityType>().notNull(),
  outcome: text("outcome"),
  companyId: integer("company_id").references(() => companies.id),
  personId: integer("person_id").references(() => people.id),
  userId: integer("user_id").references(() => users.id),
  notes: text("notes"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  ownerId: integer("owner_id").references(() => users.id),
  companyId: integer("company_id").references(() => companies.id),
  dueDate: timestamp("due_date", { withTimezone: true }),
  done: boolean("done").notNull().default(false),
  createdAt: created(),
});

export type DealStage = "first_meeting" | "terms" | "agreement_signed" | "placement";
export const deals = pgTable("deals", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  roleTitle: text("role_title").notNull(),
  stage: text("stage").$type<DealStage>().notNull(),
  estSalary: integer("est_salary").notNull(),
  feePct: integer("fee_pct").notNull(),
  ownerId: integer("owner_id").references(() => users.id),
  expectedClose: timestamp("expected_close", { withTimezone: true }),
});

export type DraftKind = "cold_email" | "follow_up" | "connection_note" | "linkedin_message";
export const drafts = pgTable("drafts", {
  id: serial("id").primaryKey(),
  kind: text("kind").$type<DraftKind>().notNull(),
  personId: integer("person_id").references(() => people.id),
  companyId: integer("company_id").references(() => companies.id),
  subject: text("subject"),
  body: text("body").notNull(),
  status: text("status").$type<"draft" | "approved" | "sent">().notNull().default("draft"),
  writtenBy: text("written_by").notNull().default("claude"),
  createdAt: created(),
});

/** An open role we are filling: the job description, what it requires, and its vector for matching. */
export const searches = pgTable("searches", {
  id: serial("id").primaryKey(),
  /** The client, when it is an account. A role can also be entered with just a client name. */
  companyId: integer("company_id").references(() => companies.id),
  clientName: text("client_name"),
  title: text("title").notNull(),
  /** The job description as written. */
  description: text("description"),
  /** What the role needs, in a form that can be scored: tools with minimum years, company size, pay. */
  requirements: jsonb("requirements").$type<Requirements>(),
  embedding: vector("embedding", { dimensions: 512 }),
  isSample: boolean("is_sample").notNull().default(false),
  status: text("status").$type<"open" | "on_hold" | "filled">().notNull().default("open"),
  mustHaves: text("must_haves"),
  stack: text("stack"),
  compRange: text("comp_range"),
  process: text("process"),
  sellingPoints: text("selling_points"),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A candidate's resume as structured data (see src/core/candidate-schema.ts), one row per
 * candidate. `profileText` is the same profile as prose and `embedding` is that prose as a
 * vector; both are rebuilt whenever the profile is saved.
 */
export const candidateProfiles = pgTable("candidate_profiles", {
  personId: integer("person_id").primaryKey().references(() => people.id),
  profile: jsonb("profile").$type<Profile>().notNull(),
  profileText: text("profile_text").notNull().default(""),
  embedding: vector("embedding", { dimensions: 512 }),
  completeness: integer("completeness").notNull().default(0),
  isSample: boolean("is_sample").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A profile cut into parts (summary, tools, each job, work style), each with its own vector.
 * Search compares the query with every part and takes the closest, so a question about how
 * someone works is answered by their work-style part, not blurred across the whole resume.
 */
export const candidateChunks = pgTable("candidate_chunks", {
  id: serial("id").primaryKey(),
  personId: integer("person_id").notNull().references(() => people.id),
  kind: text("kind").$type<"summary" | "tools" | "experience" | "work_style">().notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 512 }),
});

export type CandidateSourceKind = "linkedin" | "resume" | "application" | "screen_call" | "conversation" | "recruiter_note";
/**
 * Raw material about a candidate, exactly as it arrived: a pasted LinkedIn profile, a resume,
 * an application form, a screen-call transcript, messages. The profile is compiled from these,
 * and they are kept so any fact can be traced back.
 */
export const candidateSources = pgTable("candidate_sources", {
  id: serial("id").primaryKey(),
  personId: integer("person_id").notNull().references(() => people.id),
  kind: text("kind").$type<CandidateSourceKind>().notNull(),
  title: text("title"),
  content: text("content").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  /** Set once the content has been worked into the profile. */
  compiledAt: timestamp("compiled_at", { withTimezone: true }),
});

export type CandidateStage = "sourced" | "contacted" | "screened" | "submitted" | "interview" | "offer" | "placed" | "rejected";
export const searchCandidates = pgTable("search_candidates", {
  id: serial("id").primaryKey(),
  searchId: integer("search_id").notNull().references(() => searches.id),
  personId: integer("person_id").notNull().references(() => people.id),
  stage: text("stage").$type<CandidateStage>().notNull().default("sourced"),
  fitScore: integer("fit_score"),
  fitNotes: text("fit_notes"),
  source: text("source"),
});

export const agreements = pgTable("agreements", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  kind: text("kind").notNull(),
  feePct: integer("fee_pct").notNull(),
  guaranteeDays: integer("guarantee_days").notNull(),
  status: text("status").$type<"draft" | "sent" | "signed">().notNull(),
  provider: text("provider").$type<"PandaDoc" | "Docusign">().notNull(),
  signedAt: timestamp("signed_at", { withTimezone: true }),
});

export type InvoiceStatus = "not_invoiced" | "invoiced" | "paid" | "overdue";
export const placements = pgTable("placements", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  personId: integer("person_id").references(() => people.id),
  roleTitle: text("role_title").notNull(),
  salary: integer("salary").notNull(),
  feePct: integer("fee_pct").notNull(),
  startDate: timestamp("start_date", { withTimezone: true }),
  invoiceStatus: text("invoice_status").$type<InvoiceStatus>().notNull().default("not_invoiced"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  createdAt: created(),
});

export type JobPostingStatus = "new" | "kept" | "dismissed";
/** Jobs seen in LinkedIn job alert emails. A posting is evidence a company is hiring; it is not yet an account. */
export const jobPostings = pgTable("job_postings", {
  id: serial("id").primaryKey(),
  /** LinkedIn job id. Dedupe key. */
  externalId: text("external_id").notNull().unique(),
  title: text("title").notNull(),
  companyName: text("company_name").notNull(),
  /** Set when the company name matches an account we already have. */
  companyId: integer("company_id").references(() => companies.id),
  location: text("location"),
  workplace: text("workplace"),
  salary: text("salary"),
  url: text("url"),
  source: text("source").notNull().default("LinkedIn job alert"),
  alertKind: text("alert_kind"),
  alertSubject: text("alert_subject"),
  emailThreadId: text("email_thread_id"),
  status: text("status").$type<JobPostingStatus>().notNull().default("new"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  createdAt: created(),
});

export type StaffingStatus = "confirmed" | "suspected" | "not_staffing";
/**
 * Running archive of staffing firms, recruiters and job boards. Anything from a confirmed or
 * suspected firm is dropped on the way in. "not_staffing" is the allow-list for false alarms.
 */
export const staffingFirms = pgTable("staffing_firms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  /** Lower-case name without punctuation or company suffixes. The match key. */
  nameKey: text("name_key").notNull().unique(),
  domain: text("domain"),
  status: text("status").$type<StaffingStatus>().notNull().default("suspected"),
  source: text("source").notNull(),
  note: text("note"),
  timesSeen: integer("times_seen").notNull().default(1),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ContextKind = "routine" | "skill";
/**
 * The AI context store: the instructions Claude reads before working in this app.
 * Routines are jobs that can be queued; skills are standing guidance. Shipped defaults come
 * from the context/ folder; edits made in the app live here and are never overwritten.
 */
export const contextDocs = pgTable("context_docs", {
  slug: text("slug").primaryKey(),
  kind: text("kind").$type<ContextKind>().notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  schedule: text("schedule"),
  basedOn: text("based_on"),
  body: text("body").notNull(),
  /** True when this doc shipped with the app (so it can be reset to the shipped text). */
  shipped: boolean("shipped").notNull().default(false),
  edited: boolean("edited").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Base table: Apollo buying intent for one of our topics. Company level. Filled by the Apollo signals routine. */
export const apolloIntent = pgTable("apollo_intent", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id),
  topic: text("topic").notNull(),
  level: text("level").$type<"high" | "medium" | "low">().notNull(),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  /** One row per company, topic and day, so re-running a routine does not double count. */
  dedupeKey: text("dedupe_key").notNull().unique(),
  createdAt: created(),
});

/**
 * The kinds of signal and how much each one counts. `weight` is the points a fresh signal is
 * worth; `halfLifeDays` is how fast it fades (after one half-life it is worth half).
 * Editable on the Signal scoring screen.
 */
export const signalTypes = pgTable("signal_types", {
  type: text("type").primaryKey(),
  level: text("level").$type<"company" | "person">().notNull(),
  label: text("label").notNull(),
  weight: integer("weight").notNull(),
  halfLifeDays: integer("half_life_days").notNull(),
  description: text("description"),
});

export type JobStatus = "queued" | "in_progress" | "done" | "failed";
/**
 * Work queued for Claude. A button in the app adds a row; a Claude run
 * (Duet routine, Cowork task or Claude Code) picks it up over MCP and writes the result back.
 */
export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  status: text("status").$type<JobStatus>().notNull().default("queued"),
  result: text("result"),
  createdAt: created(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const creditLedger = pgTable("credit_ledger", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().default("apollo"),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  createdAt: created(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
});
