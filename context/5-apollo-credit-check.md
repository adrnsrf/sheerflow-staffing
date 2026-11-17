---
kind: routine
name: Apollo credit check
schedule: Mondays, and before any paid Apollo step
summary: Read the Apollo balance and record it, so Budgets shows what is left and what the reserve allows.
based_on: sheerflow-credit-autopilot (original unchanged)
---
1. Read the team's credit usage from Apollo: remaining, plan limit, reset date. This read is free.
2. Save it with `record_apollo_credits` (balance = remaining, reason = "Weekly credit check" or the name of the run that is about to spend).
3. Work out: days to reset, weekly budget (remaining / weeks to reset, at least 1), and the reserve (20% of the plan limit).

Finish with `complete_job`: balance, weekly budget, reserve, reset date. Say plainly if the balance is within 10% of the reserve.
