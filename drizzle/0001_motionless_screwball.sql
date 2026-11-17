CREATE TABLE "job_postings" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"company_name" text NOT NULL,
	"company_id" integer,
	"location" text,
	"workplace" text,
	"salary" text,
	"url" text,
	"source" text DEFAULT 'LinkedIn job alert' NOT NULL,
	"alert_kind" text,
	"alert_subject" text,
	"email_thread_id" text,
	"likely_staffing" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_postings_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
ALTER TABLE "call_queue" DROP CONSTRAINT "call_queue_company_id_unique";--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "domain" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "call_queue" ADD COLUMN "source_status" text;--> statement-breakpoint
ALTER TABLE "call_queue" ADD COLUMN "source_key" text;--> statement-breakpoint
ALTER TABLE "call_queue" ADD COLUMN "batch" text;--> statement-breakpoint
ALTER TABLE "call_queue" ADD COLUMN "meeting_booked" text;--> statement-breakpoint
ALTER TABLE "call_queue" ADD COLUMN "alternate_dms" text;--> statement-breakpoint
ALTER TABLE "call_queue" ADD COLUMN "raw" jsonb;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "apollo_account_id" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "headcount_growth" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "keywords" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "technical_recruiters" integer;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "avg_data_salary_k" integer;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "open_data_roles" integer;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "apollo_contact_id" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "phone_type" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "time_in_role" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "connection_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "connected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "signals" ADD COLUMN "career_page_link" text;--> statement-breakpoint
ALTER TABLE "signals" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "signals" ADD COLUMN "is_us" text;--> statement-breakpoint
ALTER TABLE "signals" ADD COLUMN "search_query" text;--> statement-breakpoint
ALTER TABLE "signals" ADD COLUMN "found_on" text;--> statement-breakpoint
ALTER TABLE "signals" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "signals" ADD COLUMN "raw" jsonb;--> statement-breakpoint
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_queue" ADD CONSTRAINT "call_queue_source_key_unique" UNIQUE("source_key");