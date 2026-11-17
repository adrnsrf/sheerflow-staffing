/**
 * The transformation layer. Every file in models/ is one SELECT, and becomes a database view
 * named after the file: staging views put each source into one common shape, marts build on
 * them (signals_fact, then company_heat and person_heat).
 *
 * This is the layout dbt uses, on purpose. Today the views are simply rebuilt each time the app
 * starts, which is all a few thousand rows need. If this moves to a hosted Postgres, the same
 * files become dbt models with no rewrite.
 */
import fs from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";

const DIR = path.join(process.cwd(), "models");
// Build order: a view can only use views that come before it.
const MARTS = ["signals_fact", "company_heat", "person_heat", "outreach_touches", "person_outreach"];

/** How much each kind of signal counts when the app is first set up. Edit them in the app afterwards. */
const SIGNAL_TYPES: [string, "company" | "person", string, number, number, string][] = [
  ["spoke_with_us", "person", "Spoke with us", 35, 30, "A call where the decision maker picked up, or a meeting was booked."],
  ["email_requested", "person", "Asked for an email", 30, 14, "They asked us to send an email instead of talking."],
  ["replied", "person", "Replied to an email", 30, 21, "Any reply to our outreach."],
  ["hiring_post", "person", "Posted about hiring", 30, 14, "A LinkedIn post saying they or their team are hiring data people."],
  ["linkedin_accepted", "person", "Accepted on LinkedIn", 25, 21, "They accepted a connection request."],
  ["new_leader_post", "person", "New data leader", 25, 60, "A post about starting as head of data, VP of data or similar."],
  ["apollo_intent", "company", "Apollo buying intent", 20, 30, "Apollo sees the company researching one of our topics."],
  ["new_in_role", "person", "New in role", 15, 90, "A decision maker under six months in the role."],
  ["open_roles", "company", "Open data roles", 15, 45, "Open data roles counted during company research."],
  ["funding", "company", "Funding", 15, 180, "A funding round."],
  ["job_posting", "company", "Job posting", 12, 21, "A data role posted on LinkedIn or seen in Apollo."],
  ["other", "company", "Other", 8, 30, "Anything else worth noting."],
];

export async function buildModels(pg: PGlite) {
  for (const [type, level, label, weight, half, description] of SIGNAL_TYPES) {
    await pg.query("insert into signal_types (type, level, label, weight, half_life_days, description) values ($1,$2,$3,$4,$5,$6) on conflict (type) do nothing", [type, level, label, weight, half, description]);
  }
  const staging = fs.readdirSync(path.join(DIR, "staging")).filter((f) => f.endsWith(".sql")).map((f) => f.replace(".sql", "")).sort();
  for (const name of [...MARTS].reverse()) await pg.exec(`drop view if exists ${name} cascade`);
  for (const name of staging) await pg.exec(`drop view if exists ${name} cascade`);
  for (const name of staging) await pg.exec(`create view ${name} as\n${fs.readFileSync(path.join(DIR, "staging", `${name}.sql`), "utf8")}`);
  for (const name of MARTS) await pg.exec(`create view ${name} as\n${fs.readFileSync(path.join(DIR, "marts", `${name}.sql`), "utf8")}`);
}
