CREATE TABLE "call_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"call_queue_id" integer,
	"company_id" integer,
	"person_id" integer,
	"phone_number_id" integer,
	"user_id" integer,
	"outcome" text NOT NULL,
	"notes" text,
	"source" text DEFAULT 'app' NOT NULL,
	"called_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "context_docs" (
	"slug" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"schedule" text,
	"based_on" text,
	"body" text NOT NULL,
	"shipped" boolean DEFAULT false NOT NULL,
	"edited" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phone_numbers" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"person_id" integer,
	"number" text NOT NULL,
	"digits" text NOT NULL,
	"kind" text DEFAULT 'unknown' NOT NULL,
	"label" text,
	"source" text NOT NULL,
	"source_detail" text,
	"status" text DEFAULT 'unverified' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staffing_firms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"domain" text,
	"status" text DEFAULT 'suspected' NOT NULL,
	"source" text NOT NULL,
	"note" text,
	"times_seen" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staffing_firms_name_key_unique" UNIQUE("name_key")
);
--> statement-breakpoint
ALTER TABLE "call_log" ADD CONSTRAINT "call_log_call_queue_id_call_queue_id_fk" FOREIGN KEY ("call_queue_id") REFERENCES "public"."call_queue"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_log" ADD CONSTRAINT "call_log_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_log" ADD CONSTRAINT "call_log_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_log" ADD CONSTRAINT "call_log_phone_number_id_phone_numbers_id_fk" FOREIGN KEY ("phone_number_id") REFERENCES "public"."phone_numbers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_log" ADD CONSTRAINT "call_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_postings" DROP COLUMN "likely_staffing";