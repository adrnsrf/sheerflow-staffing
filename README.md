# SheerFlow platform (v0)

One app for business development, candidate sourcing and running the business, built from the
SheerFlow Platform Plan v0. This build runs entirely on your computer with made-up sample data.
No connector is live: nothing is sent, connected or spent.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. The first start creates a local database in `.data/` and fills it
with sample data. To wipe it and start again, stop the app and run:

```bash
npm run db:reset
```

## Claude does the work behind the buttons

Buttons such as "Ask Claude to draft the follow-up" add a job to Claude's list. The button then
reads "Queued for Claude", and asking twice does not queue it twice. Jobs wait until Claude runs.

- **Hand Claude a batch** (Claude screen) queues the top of your to-do list in one press:
  follow-up drafts, connection notes, company briefs, phone research.
- **Run Claude now** (Claude screen) starts Claude Code on this computer, pointed at this app,
  and works up to fifteen waiting jobs per run. It uses the Claude account Claude Code is signed in to: no
  API key, no per-use bill. The screen shows the run in progress, what each job produced, and
  Claude's summary.
- **On a schedule**: have a scheduled task call `curl -X POST http://localhost:3000/api/claude/run`
  while the app is running.
- **What a run may use**: this app's tools and web search. To let runs read Gmail or Apollo, add
  the names of those read-only tools to `CLAUDE_EXTRA_TOOLS` in `.env.local` (comma separated).
  Never add a tool that sends or spends.
- **Chat with your data**: connect Claude Code once with
  `claude mcp add --transport http sheerflow http://localhost:3000/api/mcp`, then ask it things.

The app itself never calls Claude's API. Claude Duet and Cowork can only reach the app once it is
hosted at a public address with a login in front of it.

## How it is put together

```
src/db/schema.ts      The shared core: companies, people, phone numbers, signals, call list, call log,
                      activities, job postings, staffing firms, context docs, tasks, deals, drafts,
                      searches, agreements, placements, Claude jobs, credit ledger.
src/db/seed.ts        Sample data, shaped like the DFC call sheet and the hiring posts sheet.
src/core/             All the rules, in one place.
  index.ts            Dedupe, ranking, call outcomes and statuses, connection queue, job queue, KPIs.
  phones.ts           Phone numbers and what the call log says about each one.
  staffing.ts         The staffing-firm archive and the check against it.
  context.ts          The AI context store (skills and routines).
  imports.ts          Importers for the sheets, job alert emails and LinkedIn's export.
  signals.ts          Reads the signal model; feeds Apollo intent and job postings.
  candidate-schema.ts The candidate profile: a resume as structured data, and what is missing from it.
  candidates.ts       The candidate list, raw sources and the compile queue.
  matching.ts         Roles, requirements, vector search and candidate-to-role matching.
  embeddings.ts       Text to vectors with a model that runs on this machine.
  decisions.ts        The rules that turn scores into Next actions.
context/              Shipped skills and routines, as Markdown. Copied into the database on start.
models/               The transformation layer: one SQL SELECT per file, built as database views.
  claude-runner.ts    Starts a Claude Code run against the job queue and records the result.
src/app/              The screens. Buttons call src/app/actions.ts, which calls src/core.
src/mcp/server.ts     The tools Claude gets. Each one calls the same src/core function a button does.
src/connectors/       One entry per outside tool (Apollo, Gmail, Sheets, ...). Apollo goes live with a key; the rest are sample mode.
drizzle/              Database migrations, generated from the schema (npm run db:generate).
```

Two paths lead to the same logic, so a rule is written once:

```
Screen button  ->  server action  ─┐
                                   ├->  src/core  ->  database
Claude run     ->  MCP tool       ─┘
```

**Database.** Postgres, running inside the app (PGlite) so there is nothing to install. The
schema is plain Postgres, so moving to Supabase later means pointing `src/db/client.ts` at it;
the schema and every query stay as they are.

**Dedupe happens once, at the core.** Companies match on domain, people on LinkedIn URL, signals
on external id (the LinkedIn Post ID). Imports append and skip duplicates; existing rows are not
overwritten.

**The job queue.** A button such as "Connect?" or "Ask Claude to refresh brief" adds a row to
`jobs`. A Claude run calls `list_jobs`, does the work, writes the result back (`draft_note`,
`save_draft`, `add_signal`, ...) and calls `complete_job`.

**Ground rules in the code.** No MCP tool sends email, sends a LinkedIn request or spends Apollo
credits. Do-not-contact companies cannot be put on the call list. Connection notes are capped at
300 characters. Logging a call appends an activity; it never edits a past one.

## What works in v0, and what is a placeholder

| Area | Works now | Placeholder |
| --- | --- | --- |
| Signals inbox | Ranked list; keep, dismiss, promote to call list | Real feeds (daily posts routine, Gmail alerts) |
| Call list | Per-rep queues, outcome buttons, notes, bad-number warning | Click-to-call through a dialer, Sheets sync |
| Connection queue | Tick Connect?, edit note, copy and open profile, mark sent / connected | Notes are written by a Claude run |
| Accounts | List, search, one-page account view with every touch | Briefs come from the company-research skill |
| Outreach drafts | Review, approve, copy | Push to Gmail drafts or an Apollo sequence |
| Deals, clients, money | Add by hand, move stages, mark agreements signed and invoices paid | PandaDoc, Docusign and QuickBooks data |
| Sourcing | Candidate profiles, personality scales, raw sources, vector search, roles, matching with reasons, one-click outreach, candidate actions, pipeline stages | Application form, live Retell calls, reply tracking, submittal packets |
| Numbers | Weekly funnel against targets, saved weekly review, vendor view, credit budget | Targets and vendor cost are placeholders to edit |
| Signals | Scored signal model, Next actions with reasons, editable weights | Apollo intent and Apollo job postings have no data until the routine runs |
| Claude | 48 tools, job queue with a Run button, editable instructions | Scheduled runs need a scheduled task; Gmail and Apollo in runs need their tools allowed |
| Logins | None: one local user | Supabase login for reps and D Foster |

## Real data: imports

The Import screen (System, Import) brings over what the routines have produced so far:

| Source | Lands in | Dedupe key |
| --- | --- | --- |
| DFC call sheet ("Call List - Nov 2026") | Accounts, People, Phone numbers, Call list, plus one call-log row per dated entry in DFC Notes | Apollo contact id, else LinkedIn URL, else company + name |
| LinkedIn hiring posts sheet | Signals inbox, People (posters), Accounts | Post ID |
| LinkedIn job alert emails | Job alerts | LinkedIn job id |
| LinkedIn Connections export | Marks people connected | LinkedIn URL |

Put `call-list.json`, `hiring-posts.json` and `job-alerts.json` in an `imports/` folder at the top
of the project (or upload a CSV saved from the sheet), then press Import. Imports can be repeated:
new rows are added, known rows are skipped, and a row that changed in the sheet refreshes the
call-list working columns. `imports/` is never committed, because it holds real contact data.

If `imports/` has files when the database is first created, the app starts empty instead of with
sample data. `npm run db:reset` then restart gives a fresh start either way.

How the sheet columns map (first pass, expected to change):

- **Company columns** go on `companies`: employees, headcount growth, keywords, recruiter team
  size, technical recruiters, analytics team size, average data salary, open data roles, company
  phone, alt company phones, Apollo org and account ids.
- **Contact columns** go on `people`: title, time in role, email, phone, phone type, location,
  LinkedIn URL, Apollo person and contact ids.
- **DFC columns** go on `call_queue`: Call Status is kept word for word in `source_status` and
  also mapped to a shorter app status; last contact, next step, meeting booked, DFC notes,
  alternate decision makers and batch are stored as they are.
- **Hiring post columns** go on `signals` (category, roles, location, US?, career check, search
  query, notes), with the poster on `people` and Connect? / Connection Note / Connected as that
  person's LinkedIn status.
- Every imported row is also kept whole in a `raw` column, so nothing is lost while this settles.

Open questions the data raised are listed at the end of this file.

## LinkedIn, by hand

The app never signs in to LinkedIn, never runs a hidden browser against it and never sends
anything. LinkedIn's terms prohibit automated activity and accounts get restricted for it.
What the buttons do instead:

- **Connect** opens the profile in a new tab (with the note on your clipboard if there is one)
  and marks the request as sent. You press Connect on LinkedIn. Undo is one click.
- **Draft note first** queues a job; a Claude run writes a note of 300 characters or fewer.
- **Check who accepted**: press Mark connected on one person, or upload the Connections.csv from
  LinkedIn's own data export (Settings, Data privacy, Get a copy of your data) to check everyone.
- **Draft message** (once connected) queues a job; the draft appears in Outreach drafts with a
  "Copy and open profile" button.

## Calls, phone numbers and statuses

- **Phone numbers** are their own table: one row per number, for a company line or a person's
  line, with its source (Apollo, Claude research, call sheet, typed in) and a status learned from
  calls. Rows link to the app's own company and person records, which carry the Apollo ids; the
  Apollo id is not the key, because posts and research produce companies Apollo has not seen.
- **Call log**: one row per dial, tied to the number dialed. A bad-number outcome marks that
  number bad, not the company. History read out of DFC Notes is tagged `call_sheet` and its
  outcome is guessed from the wording.
- **Outcome and status are two things.** The caller picks what happened on the dial (connected,
  meeting booked, email requested, voicemail, no answer, gatekeeper, bad number, wrong person, not
  interested, do not contact). The row's status follows from it (not started, attempting,
  connected, meeting booked, needs info, closed, do not contact). A bad number only stalls a row
  when no other number is left to try. The sheet's "Error" maps to needs info.

## Signals and next actions

Every reason to reach out is a signal. Sources keep their own base tables; SQL views in
`models/` put them in one shape and score them; a small set of rules turns the scores into
suggestions.

```
base tables                      staging views (one per source)        marts
signals (LinkedIn posts, events) stg_signal_linkedin_posts   person
job_postings (LinkedIn, Apollo)  stg_signal_job_postings     company
apollo_intent                    stg_signal_apollo_intent    company   signals_fact  ->  company_heat
companies (research columns)     stg_signal_company_research company        |            person_heat
people (time in role)            stg_signal_new_in_role      person         v
call_log, people, activities     stg_signal_engagement       person    Next actions (src/core/decisions.ts)
signals (other one-offs)         stg_signal_other_events     company
```

- **signals_fact** has one row per signal event: level (company or person), type, source, date,
  title, and a score. Score = the type's weight x strength x decay, where decay halves the value
  every half-life. Weights and half-lives are on the Signal scoring screen and can be changed.
- **company_heat** adds a company's signals up, with each type capped at 1.5x its weight, and
  adds fit (thin recruiting team, 51 to 500 people, a data team, ICP tier). Priority = heat + fit.
- **Next actions** applies rules to where things stand: accepted on LinkedIn and not messaged
  means message; a note is ready means send the request; a hot person with no connection means
  connect; a week without a LinkedIn answer means call; spoke and no follow-up means follow up;
  a hot, fitting company nobody is calling means add it to the call list; a bad number or wrong
  contact means research. Each suggestion shows the signals behind it. The call list is ordered
  by priority.

To add a new signal source: add a base table (or reuse one), add one `stg_signal_*.sql` file
with the same eleven columns, add it to the union in `models/marts/signals_fact.sql`, and add
its type on the Signal scoring screen's table (`signal_types`).

### Why no Airflow or dbt yet

The models folder follows dbt's layout (staging, marts, one SELECT per file) so the files can
become dbt models unchanged. They are not run by dbt today because the database lives inside
the app (dbt cannot connect to it), and at a few thousand rows plain views are always fresh
with nothing to schedule. Airflow would be a second server to run for jobs that Claude routines
already do. The point to adopt them is after moving to a hosted Postgres (Supabase): dbt first,
for tests and history tables; a scheduler only if routines need to run without a Claude session.

## Candidates, roles and matching

**One compiled profile per candidate.** `candidate_profiles.profile` is a resume as structured
JSON: tools with years, last use and level; jobs with company size, responsibilities and
results; location, pay, availability, work authorization; how they work and what they want; the
screen summary. The shape is defined and checked in `src/core/candidate-schema.ts`.

**Where the facts come from.** Raw material is kept as received in `candidate_sources`
(LinkedIn profile, resume, application, screen call, messages, recruiter note). Adding a source
queues a `compile_candidate` job; a Claude run reads the sources and writes the whole profile
with `save_candidate_profile`. Tools and traits record their source and whether the candidate
said it or it was worked out. Each profile shows a "% known" figure and lists what is missing
and which intake step usually supplies it.

| Field | Usual source | How sure |
| --- | --- | --- |
| Work history, responsibilities, tools used | LinkedIn profile or resume | High |
| Years on each tool | Worked out from job dates; confirmed in the application or screen | Low until confirmed |
| Location, remote preference, pay, notice, work authorization | Application form or screen call | High once asked |
| Work style, what they want and want to avoid | Screen call (Retell AI or you), messages | Medium; evidence is recorded |
| Company sizes worked in | Worked out from employers | Medium |

**Personality.** Each profile has eight scales from 1 to 5: breadth (jack of all trades to
deep specialist), structure (thrives in ambiguity to wants clear process), pace (laid back to
driven), demeanor (light to serious), confidence (reserved to assertive), working style
(independent to collaborative), audience (best with engineers to best with business people) and
leadership (hands-on to leads people), plus interests and notes. A scale is filled in by hand on
the candidate page or by a Claude run after a screen call, always with what it is based on and
whether it is their words or our reading. Most profiles will have a few scales, not all eight.
A role can say the kind of person the team wants on the same scales. Style then joins the
requirements score, weighted by how much could be compared: a scale nobody has filled in
neither helps nor hurts. Interests are for rapport and never scored.

**Roles.** A role holds its job description and its requirements in scoreable form: tools with
minimum years and must/nice, total years, company size, workplace and city, top of the pay band.
Requirements are read from the pasted description and can be edited.

**Matching uses two scores.** Requirements (65%): years on each required tool, experience,
company size, location, pay. Similarity (35%): vector closeness of the whole profile to the job
description. A candidate missing a must-have tool is capped at 55. Vectors alone are not used
for requirements because an embedding cannot tell five years of a tool from one, or Azure from
AWS; the vector finds the right kind of person and the facts check the fit. Every match lists
its reasons.

**Vector search.** Profiles are embedded on this machine by a model that ships as an npm
package (Universal Sentence Encoder, 512 dimensions): no API key, no cost, nothing sent out.
Vectors live in Postgres (pgvector). Each profile is stored whole (for role matching) and in
parts (summary, tools, each job, work style); plain-language search ranks candidates by their
closest part and shows which part matched. The model is small: it is reliable for the kind of
work someone does and weaker on fine shades of personality. To change models, edit
`src/core/embeddings.ts` and re-save the profiles.

**One-click outreach.** Every candidate has the same buttons, on the Candidate actions screen,
on each role's matches and on the candidate's own page:

- **Connect with role note** copies a note of 300 characters or fewer about the role, opens
  their LinkedIn profile and marks the request sent. If you are already connected it is
  **Message on LinkedIn** instead.
- **Email** opens Gmail with the subject and body written; you press Send there.
- **Text** copies the text and opens your messaging app with it filled in.
- **AI screen call** asks Retell to call them with a brief built from the role. It is the only
  button that acts by itself, so it is locked until the candidate's consent to an automated
  call is recorded on their profile (US rules require prior consent for AI-voice calls and
  automated texts). Without Retell keys it records the request and places no call.

The words come from a template in `src/core/outreach.ts` that uses the candidate's matching
tools and the role's stack, setting and pay, and never names the client. Each press logs the
touch, puts the person in the role's pipeline and moves them to "contacted".

**Candidate actions** is the candidate-side to-do list, built by rules in
`src/core/candidate-actions.ts`: reach out to strong matches nobody has contacted (each person
is pitched their best role only), nudge once after five days without a reply, start a screen
when they have agreed to a call, check a call that is out, submit after a screen if the match
is still strong, and compile profiles with new material.

**Sample data.** 24 made-up candidates and 7 made-up roles load on first run so search and
matching can be tried. They are labelled "Sample" and one button on the Candidates screen
removes them.

Not built or not proven yet: a public application form; pulling applications from LinkedIn job
posts; replies (the app cannot see a LinkedIn or email reply, so "no reply" means none was
logged); and the Retell connection, which is written but has never been run against Retell.

## Outreach over time

Every touch is one row in the `outreach_touches` view: calls from the call log, LinkedIn
requests, emails, texts and meetings from activities, and anything Claude prepared for a person.
`person_outreach` rolls that up per person.

- **In progress** (To do, In progress) lists everyone already contacted in four groups: they
  responded, due for the next step, waiting on them, finished for now. Each row shows the
  touches as dots, the last contact, and the next step with its date.
- **The waits** live in `src/core/history.ts`: 7 days for a LinkedIn request, 5 days for a reply
  to an email or message, 2 days before calling back, and after 4 tries with no answer the
  person rests for 30 days.
- **Activity** is the same touches as a day-by-day feed.
- **Already worked** markers ("Email 3 days ago · 2x") appear beside names on People,
  Candidates and To do, and To do shows today's count against a daily plan and LinkedIn's
  weekly limit.

History read from the old call sheet counts as contact, but not toward today's numbers.

## Backup

Settings, Import, Backup downloads everything in the app as one file, and restores from one.
Restore replaces all data in a single step: if the file cannot be read in full, nothing changes.
Search vectors are rebuilt after a restore. Use it to keep copies and to move work between
computers. The file contains real contact data; treat it like the sheets.

## Staffing firms

`staffing_firms` is a running archive of staffing firms, recruiters and job boards. Anything
arriving under a listed name (job alert, hiring post, company import) is dropped and the firm's
count goes up. New names that match a narrow pattern are added as "suspected" for review; mark a
real employer "not staffing" and it is let through from then on. Claude checks names with
`check_staffing_firms` and adds confirmed firms with `add_staffing_firm`.

## AI context store

The AI context screen holds what Claude reads before working in the app: **skills** (standing
guidance such as ground rules, call outcomes, the staffing screen, phone research) and
**routines** (jobs you can queue). Defaults ship as Markdown in `context/` and are copied into
the database on start. Edit any of them in the app, or add your own; your version is kept even
when the shipped file changes, and "Reset to shipped text" undoes your edits. Claude reads the
store with `list_context` and `get_context` and is told to read `ground-rules` first. It cannot
write to the store: instructions change only by your hand. The original Claude skills are not
touched, and nothing runs on a timer yet.

## Apollo

Apollo data reaches the app two ways, and both end in the same `src/core` functions:

- **Through Claude (no key needed).** A Claude run reads Apollo with its own connector, then
  writes here with `import_companies`, `add_signal` and `record_apollo_credits`. This runs on
  your Claude account and is where anything that costs credits belongs, behind your approval.
- **Directly (API key).** Put `APOLLO_API_KEY=your-key` in `.env.local` and restart. The Apollo
  screen (Connections, Apollo, Open) then lists your saved lists and imports companies from a
  list 25 at a time. Only zero-credit reads are built: `src/connectors/apollo.ts`.

The direct path has not been run against Apollo yet (no key was available when it was written),
so expect small fixes to field names on first use.

## Making a connector live

Each entry in `src/connectors/index.ts` names the env vars it will need. To switch one on, put
the keys in `.env.local` (never committed), replace the sample `test()` with a real call, and add
the methods the core needs (for Apollo: free company and people search, credit balance).

## Open questions from the real data

- **Call history is approximate.** DFC Notes are split into one call per dated entry and the
  outcome is guessed from the wording. 18 of 363 entries could not be classified.
- **ICP score.** Neither sheet carries a tier or score, so imported accounts show "Unscored" and
  signals rank by date only until scoring runs.
- **Posters without a real name.** Some hiring-post rows have a handle instead of a name, and 71
  posts have US? = Unknown.
- **One company, several sources.** A company from the posts sheet with no website matches the
  call sheet only if the names are identical.
- **The sheet is still where the team works.** Re-importing refreshes the app from the sheet;
  calls logged in the app do not flow back to the sheet.
