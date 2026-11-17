---
kind: skill
name: Deciding who to reach and why
summary: How signals are scored, how Next actions is built, and how to explain or question a recommendation.
based_on: The signal model in models/ and the rules in src/core/decisions.ts
---
Use this when Adrian asks who to contact, why someone is on the list, or what to do today.

How it works
- Every reason to reach out is a signal: a row in `signals_fact`. Signals are about a person (posted about hiring, new in role, accepted on LinkedIn, spoke with us) or a company (open data roles, job postings, Apollo buying intent, funding).
- Each signal type has a weight and a half-life. A fresh signal is worth its weight; it halves every half-life. A hiring post is strong for two weeks and then fades. Something the person did in reply to us (picked up, asked for an email, accepted) outranks anything we merely observed.
- A company's heat is its signals added up, with each type capped so one noisy source cannot dominate. Fit (thin recruiting team, 51 to 500 people, a data team) adds to priority but is never a reason to act without a signal.
- `get_next_actions` applies simple rules to where things stand: accepted and not yet messaged means message; a note is ready means send the request; a hot person with no connection means connect; a week without a LinkedIn answer means call; spoke and no follow-up means follow up; a hot, fitting company nobody is calling means add it to the call list; a bad number means research.

When you answer
- Start from `get_next_actions`. Give the top few, each with the reason in plain words and the date of the signal.
- For "why this company?", call `get_signals` and quote the signals, strongest first. Say when a signal is old.
- Say what is missing. No Apollo intent readings yet means intent is not part of the score yet. Imported call outcomes were guessed from notes.
- Do not invent urgency. If nothing scores well, say the list is thin and suggest a routine that would bring in fresh signals.
- You recommend; Adrian acts. Never mark something sent or connected yourself unless he tells you he did it.
