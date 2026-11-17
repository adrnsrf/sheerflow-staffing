CREATE TABLE "candidate_chunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"kind" text NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(512)
);
--> statement-breakpoint
ALTER TABLE "candidate_chunks" ADD CONSTRAINT "candidate_chunks_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;