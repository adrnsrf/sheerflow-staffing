---
kind: routine
name: Apollo signals refresh
schedule: Mondays
summary: Bring in Apollo's company-level signals: buying intent for our topics and open data roles at accounts we already have.
based_on: sheerflow-apollo-job-postings-signal and the staffing intent line in sheerflow-hot-leads (originals unchanged)
---
Follow the ground rules and the credit rules in the Apollo credit check routine. Use free lookups first. If a step would cost credits, stop and say what it would cost; do not spend without Adrian's yes.

Buying intent (company level)
1. In Apollo, read which companies show intent for our topics (staffing, IT staff augmentation, data engineering hiring, or whatever topics are set up on the account). Use the saved intent lists where they exist.
2. Run the company names through `check_staffing_firms` and drop the staffing firms.
3. Save with `add_apollo_intent`: company name, domain, Apollo id, topic, level (high, medium or low). One reading per company and topic per day is kept, so running this twice does no harm.

Open data roles (company level)
1. Take the hottest 30 accounts that are not do-not-contact (`get_next_actions`, then `get_signals` for detail).
2. For each, read Apollo's job postings and keep the data roles: data engineer, analytics engineer, BI, data analyst, data scientist, data platform, head of data.
3. Save with `add_apollo_job_postings` (company id, title, location, link, posted date, Apollo posting id).

Finish with `record_apollo_credits` and `complete_job`: intent readings added by level, postings added, companies newly created, credits spent, and anything you could not check.
