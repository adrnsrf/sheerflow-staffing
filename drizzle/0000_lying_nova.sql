CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"outcome" text,
	"company_id" integer,
	"person_id" integer,
	"user_id" integer,
	"notes" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agreements" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"kind" text NOT NULL,
	"fee_pct" integer NOT NULL,
	"guarantee_days" integer NOT NULL,
	"status" text NOT NULL,
	"provider" text NOT NULL,
	"signed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "call_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"person_id" integer,
	"owner_id" integer,
	"status" text DEFAULT 'new' NOT NULL,
	"top_signal" text,
	"last_contact_at" timestamp with time zone,
	"next_step" text,
	"next_step_date" timestamp with time zone,
	"notes" text,
	"added_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "call_queue_company_id_unique" UNIQUE("company_id")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"website" text,
	"industry" text,
	"location" text,
	"employees" integer,
	"data_team_size" integer,
	"recruiting_team_size" integer,
	"icp_tier" text,
	"icp_score" integer,
	"hq_phone" text,
	"alt_phones" text,
	"apollo_id" text,
	"status" text DEFAULT 'prospect' NOT NULL,
	"brief" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'apollo' NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"balance_after" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"role_title" text NOT NULL,
	"stage" text NOT NULL,
	"est_salary" integer NOT NULL,
	"fee_pct" integer NOT NULL,
	"owner_id" integer,
	"expected_close" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"person_id" integer,
	"company_id" integer,
	"subject" text,
	"body" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"written_by" text DEFAULT 'claude' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"result" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"company_id" integer,
	"current_employer" text,
	"location" text,
	"linkedin_url" text,
	"apollo_id" text,
	"email" text,
	"phone" text,
	"contact_revealed" boolean DEFAULT false NOT NULL,
	"connection_status" text DEFAULT 'none' NOT NULL,
	"connection_note" text,
	"skills" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_linkedin_url_unique" UNIQUE("linkedin_url")
);
--> statement-breakpoint
CREATE TABLE "placements" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"person_id" integer,
	"role_title" text NOT NULL,
	"salary" integer NOT NULL,
	"fee_pct" integer NOT NULL,
	"start_date" timestamp with time zone,
	"invoice_status" text DEFAULT 'not_invoiced' NOT NULL,
	"due_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"search_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	"stage" text DEFAULT 'sourced' NOT NULL,
	"fit_score" integer,
	"fit_notes" text,
	"source" text
);
--> statement-breakpoint
CREATE TABLE "searches" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"must_haves" text,
	"stack" text,
	"comp_range" text,
	"process" text,
	"selling_points" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"category" text,
	"title" text NOT NULL,
	"summary" text,
	"roles" text,
	"company_id" integer,
	"person_id" integer,
	"source" text NOT NULL,
	"source_url" text,
	"external_id" text,
	"career_verified" text,
	"signal_date" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signals_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"owner_id" integer,
	"company_id" integer,
	"due_date" timestamp with time zone,
	"done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_queue" ADD CONSTRAINT "call_queue_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_queue" ADD CONSTRAINT "call_queue_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_queue" ADD CONSTRAINT "call_queue_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_candidates" ADD CONSTRAINT "search_candidates_search_id_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_candidates" ADD CONSTRAINT "search_candidates_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "searches" ADD CONSTRAINT "searches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;