CREATE TABLE "screen_calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"search_id" integer,
	"status" text NOT NULL,
	"to_number" text,
	"brief" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"provider_call_id" text,
	"detail" text,
	"transcript" text,
	"summary" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "ai_contact_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "consent_note" text;--> statement-breakpoint
ALTER TABLE "screen_calls" ADD CONSTRAINT "screen_calls_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screen_calls" ADD CONSTRAINT "screen_calls_search_id_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE no action ON UPDATE no action;