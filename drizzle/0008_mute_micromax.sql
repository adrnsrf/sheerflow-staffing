CREATE TABLE "claude_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_by" text DEFAULT 'button' NOT NULL,
	"jobs_waiting" integer DEFAULT 0 NOT NULL,
	"jobs_done" integer DEFAULT 0 NOT NULL,
	"summary" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
