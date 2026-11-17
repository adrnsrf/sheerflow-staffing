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
| Claude | 19 MCP tools, job queue | Routines moved over to write here instead of the sheets |
| Logins | None: one local user | Supabase login for reps and D Foster |

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
