CREATE TABLE "candidate_profiles" (
	"person_id" integer PRIMARY KEY NOT NULL,
	"profile" jsonb NOT NULL,
	"profile_text" text DEFAULT '' NOT NULL,
	"embedding" vector(512),
	"completeness" integer DEFAULT 0 NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"kind" text NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"compiled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "searches" ALTER COLUMN "company_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "searches" ADD COLUMN "client_name" text;--> statement-breakpoint
ALTER TABLE "searches" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "searches" ADD COLUMN "requirements" jsonb;--> statement-breakpoint
ALTER TABLE "searches" ADD COLUMN "embedding" vector(512);--> statement-breakpoint
ALTER TABLE "searches" ADD COLUMN "is_sample" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_sources" ADD CONSTRAINT "candidate_sources_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;