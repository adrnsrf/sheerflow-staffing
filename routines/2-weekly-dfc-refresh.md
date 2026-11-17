---
name: Weekly DFC call-list refresh
schedule: Sundays
summary: Top up the Apollo companies list, pick the hottest 10 to 20 companies not yet on the call list, and add them with a decision maker and better phone numbers.
based_on: sheerflow-dfc-weekly-refresh, sheerflow-hot-leads and sheerflow-credit-autopilot (originals unchanged)
---
Follow sheerflow-standards. This is the app version of the Sunday refresh: it writes to SheerFlow, not to the Google Sheet.

Credits (do this first)
- Read the Apollo balance, limit and reset date. weekly_budget = remaining / weeks until reset (at least 1). reserve = 20% of the plan limit.
- A paid step is approved only when the run's total stays within weekly_budget and the balance stays above the reserve. Over budget: trim to the highest-scoring companies that fit. Would dip below the reserve, or one step costs more than half the weekly budget: do not spend, finish the free steps and report what was held.
- Never spend on Tier C or unscored companies.

Step 1: top up the companies list
1. Free ICP screen in Apollo: US, 51 to 500 employees, data roles posted in the last 60 days, staffing and consulting excluded.
2. Dedupe against the Apollo lists "Staffing - DFC Sales - Companies" and "Staffing", and against SheerFlow (`search_companies`).
3. Score for ICP fit. Add 25 to 50 new Tier A or B companies to "Staffing - DFC Sales - Companies" in Apollo, and to SheerFlow with `import_companies`.

Step 2: promote the hottest to the call list
1. Rank companies that are not on the call list (`get_call_list`) by heat: open data roles (3+ = 25, 2 = 18, 1 = 10), oldest posting 30+ days (15), new data leader under 6 months (20), funding in 12 months (15), headcount growth 15%+ (15), plus 5 when the recruiting team is 0 to 2 with no technical recruiter. Mark anything you could not check as Unknown.
2. Take the top 10 to 20. For each, find one primary decision maker and up to three alternates. Reveal the primary's email, and phone only for the top 5, within the credit rules above.
3. Find better phone numbers than the HQ switchboard (local office lines from the company website) for Alt Company Phones.
4. Save with `import_call_sheet_rows`, one row per company, keys as in the call sheet: Company, Employees, Headcount Growth (6 mo), Company Keywords, Recruiter Team Size, Technical Recruiters, Analytics Team Size, Avg Data Salary ($K), Open Data Roles, Title, Time in Role, Email, Name, Phone, Phone Type, Location, Company Phone, Alt Company Phones, Alternate Decision Makers, company_website, person_linkedin, apollo_account_id, apollo_org_id, apollo_person_id, apollo_contact_id, batch. Leave Call Status, Last Contact Date, Next Step, Next Step Date, Meeting Booked and DFC Notes out: those belong to the callers. Existing rows are never overwritten.
5. Record the balance with `record_apollo_credits`.

Finish with `complete_job`: companies added, companies promoted with the top signal for each, credits spent and balance after, and anything held and why.
