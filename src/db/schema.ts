import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

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
  domain: text("domain").notNull().unique(),
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
  email: text("email"),
  phone: text("phone"),
  contactRevealed: boolean("contact_revealed").notNull().default(false),
  connectionStatus: text("connection_status").$type<ConnectionStatus>().notNull().default("none"),
  connectionNote: text("connection_note"),
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
  careerVerified: text("career_verified").$type<"Yes" | "No" | "Partial">(),
  signalDate: timestamp("signal_date", { withTimezone: true }).notNull(),
  status: text("status").$type<SignalStatus>().notNull().default("new"),
  createdAt: created(),
});

export type CallQueueStatus = "new" | "attempting" | "connected" | "meeting_booked" | "dead" | "do_not_contact";
/** Replaces the DFC call sheet: one row per company a rep is working. */
export const callQueue = pgTable("call_queue", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id).unique(),
  personId: integer("person_id").references(() => people.id),
  ownerId: integer("owner_id").references(() => users.id),
  status: text("status").$type<CallQueueStatus>().notNull().default("new"),
  topSignal: text("top_signal"),
  lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
  nextStep: text("next_step"),
  nextStepDate: timestamp("next_step_date", { withTimezone: true }),
  notes: text("notes"),
  addedBy: text("added_by"),
  createdAt: created(),
});

export type ActivityType = "call" | "email" | "linkedin" | "meeting" | "note";
export type CallOutcome = "connected" | "voicemail" | "gatekeeper" | "no_answer" | "dead_number" | "do_not_contact" | "meeting_booked";
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

export type DraftKind = "cold_email" | "follow_up" | "connection_note";
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

export const searches = pgTable("searches", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  title: text("title").notNull(),
  status: text("status").$type<"open" | "on_hold" | "filled">().notNull().default("open"),
  mustHaves: text("must_haves"),
  stack: text("stack"),
  compRange: text("comp_range"),
  process: text("process"),
  sellingPoints: text("selling_points"),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
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
