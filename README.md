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

## Connect Claude

The app is a tool Claude uses; it never calls Claude, so it runs on your subscription and needs
no API key. With the app running, open this folder in Claude Code. It picks up `.mcp.json` and
offers the `sheerflow` connection. Or add it by hand:

```bash
claude mcp add --transport http sheerflow http://localhost:3000/api/mcp
```

Then ask things like "what are the hottest new signals in SheerFlow?" or "work the queued
SheerFlow jobs". The Claude screen in the app lists the queue and what Claude may do.

Claude Duet and Cowork can only reach the app once it is hosted at a public address (with a
login in front of it). On your own machine, Claude Code is the way to test.

## How it is put together

```
src/db/schema.ts      The shared core: companies, people, signals, activities, tasks, call list,
                      deals, drafts, searches, agreements, placements, Claude jobs, credit ledger.
src/db/seed.ts        Sample data, shaped like the DFC call sheet and the hiring posts sheet.
src/core/index.ts     All the rules, in one place: dedupe, ranking, call outcomes, the
                      connection queue, the job queue, KPIs, credit reserve.
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
| Pipeline | Stages with fee forecast | Moving deals between stages |
| Sourcing | Searches, candidate stages, talent pool search | Screens, scorecards, submittal packets |
| Management | Agreements, money, KPIs, vendor scorecard, credit budget | PandaDoc / Docusign / QuickBooks data, real targets |
| Claude | 27 MCP tools, job queue, routines | Routines moved over to write here instead of the sheets |
| Logins | None: one local user | Supabase login for reps and D Foster |

## Real data: imports

The Import screen (System, Import) brings over what the routines have produced so far:

| Source | Lands in | Dedupe key |
| --- | --- | --- |
| DFC call sheet ("Call List - Nov 2026") | Accounts, People, Call list, plus one logged call per dated entry in DFC Notes | Apollo contact id, else LinkedIn URL, else company + name |
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

## Routines

`routines/*.md` are the app's own copies of the recurring jobs, rewritten to save into the app
through the Claude tools. The original skills are not changed. The Routines screen lists them and
queues a run; Claude reads the instructions with `get_routine`. Nothing runs on a timer yet.

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

- **Call status wording.** The sheet uses nine statuses (Left Voicemail, Called - No Answer,
  Error, New Information Needed, Emailed, Wrong Contact, E-mail Requested...). The app maps them
  to seven. Decide which list the team should use going forward.
- **Call history.** DFC Notes are split into one logged call per dated entry and the outcome is
  guessed from the wording. Good enough to spot bad numbers; not exact for KPIs.
- **ICP score.** Neither sheet carries a tier or score, so imported accounts show "Unscored" and
  signals rank by date only until scoring runs.
- **Job alerts are noisy.** About 4 in 10 jobs come from staffing firms or job boards re-posting
  other companies' roles. They are flagged by name and hidden by default, not deleted.
- **Posters without a real name.** Some hiring-post rows have a handle instead of a name, and 71
  posts have US? = Unknown.
- **One company, several sources.** A company from the posts sheet with no website matches the
  call sheet only if the names are identical.
