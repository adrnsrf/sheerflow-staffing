CREATE TABLE "apollo_intent" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"topic" text NOT NULL,
	"level" text NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "apollo_intent_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "signal_types" (
	"type" text PRIMARY KEY NOT NULL,
	"level" text NOT NULL,
	"label" text NOT NULL,
	"weight" integer NOT NULL,
	"half_life_days" integer NOT NULL,
	"description" text
);
--> statement-breakpoint
ALTER TABLE "apollo_intent" ADD CONSTRAINT "apollo_intent_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;