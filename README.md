# City RL Tracker

Standings, scouting, match nights and player stats for City, University of London's two
Rocket League teams in the NSE (National Student Esports) weekly tournament:

- **City Champions**: Division 2 in Spring 26
- **City Commanders**: Swiss in Spring 26

Public to read; one admin (Ali) enters results and uploads replays. Built with Next.js 16
(App Router), Supabase (Postgres + Auth + RLS) and the ballchasing.com API, hosted on Vercel.

## Start here: current state (Winter 26, as of 5 Nov 2026)

Read this first. It answers the questions that otherwise get re-asked every session.

**Live site:** https://nse-rl-tracker.vercel.app (Vercel; every merge to `main` deploys).
Winter 26 is **already created and current** (`/winter-26/champions`, `/winter-26/commanders`) with both rosters, two scrims and Stage 1
results. Champions' and Commanders' Week 1 replays are uploaded, Champions' Week 2 (27 Oct) too. Don't re-create the season.
**Stage 1 is over for Champions: 4 wins from 6 rounds, so Division 1.** Commanders are in Group 3 (10-point Swiss) per the sheet.
**League week 3 (3 Nov)** is in three NSE tournaments (Division 1, Division 2, Swiss). Champions: Division 1, L 2–3 Manchester Pookie Pies, L 1–3 Diff Diddlers, W 3–2 UWE Sea Stags RL = **3 points**.
Commanders: Swiss, W 3–0 Swansea Slotters, W 3–1 bingo lingo, L 0–3 Herts RL Team 1 = **10 points**. NSE publishes the weekly points as headings in the "Points" round of each week page;
the importer reads them (docs/points-engine.md). A City team that changes division is moved automatically when its week is imported.

**Replay analysis** (Ali asks for write-ups after each night): method, scripts (`scripts/analysis/`) and findings so far are in **docs/analysis.md**.
Claude can only run the deep version on raw `.replay` files Ali sends as a zip into the chat; without them it reads ballchasing's public replay pages.

**Not known yet** (see TODO.md): NSE's tiebreaks (our order is points, series wins, game difference) and what a promoted or demoted team scores.

**Working rules for Claude sessions:** check the live site and `main` before proposing work.
Don't ask Ali for things already in this README, docs/ or the repo.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000 → /spring-26/champions
npm test             # engine + importer tests (Vitest)
npm run typecheck && npm run lint
```

`/` is a season picker; each season links to both teams. With no environment variables the site runs **read-only on the bundled Spring 26 snapshot**
(`src/data/seed/spring-26.json`), so every page works straight away. Add Supabase to get the
admin area: see **[docs/setup.md](docs/setup.md)**.

## What is where

| Path | What |
|---|---|
| `src/app/[season]/[team]/…` | Public pages: dashboard, `scouting`, `matches`, `players`, `standings` |
| `src/app/admin/…` | Admin: sign in, nights, scrims, replays, imports, roster, upcoming night |
| `src/app/api/admin/replays/…` | Replay upload → ballchasing, and processing (polling) |
| `src/lib/engine/` | **Pure logic, fully tested**: points, nights, stats, standings, scenarios, scouting, players |
| `src/lib/import/` | NSE HTML parser, standings-sheet CSV parser, name matching |
| `src/lib/ballchasing/` | ballchasing client and replay → stats mapping |
| `src/lib/replay/` | **Replay sorting, pure and tested**: `header.ts` reads a replay's header, `sort.ts` puts files on series + game numbers, `upload-client.ts` is the browser upload/poll loop |
| `src/lib/data/` | Loads a season as one `Dataset` from Supabase, or from the bundled seed |
| `src/lib/view/` | Turns engine output into page view-models |
| `src/components/` | UI (design tokens live in `src/app/globals.css`) |
| `supabase/migrations/` | Schema + RLS · `supabase/seed.sql` loads Spring 26 |
| `seed-data/` | Raw sources: NSE match snapshots (`nse/*.json`) and standings sheet CSVs |
| `scripts/` | `fetch-nse.ts` (snapshot NSE), `build-seed.ts` (sources → seed JSON + SQL), `analysis/` (Python replay-analysis tools, see docs/analysis.md) |
| `design-reference/` | Approved mockups (see docs/HANDOFF.md §11 for how to read them) |

## Docs

- [docs/setup.md](docs/setup.md): Supabase, Vercel, admin account, ballchasing token
- [docs/points-engine.md](docs/points-engine.md): how nights are scored, derived stats, scenarios, known anomalies
- [docs/data-model.md](docs/data-model.md): tables, why they look like this, RLS
- [TODO.md](TODO.md): build checklist and **open questions for Ali**
- [docs/analysis.md](docs/analysis.md): replay-analysis method, scripts and findings
- [docs/lessons.md](docs/lessons.md): gotchas already hit (fonts, Tailwind layers, seasons, migrations, replays) and decisions made with Ali
- [docs/HANDOFF.md](docs/HANDOFF.md): the original planning handoff

## Scripts

| Command | Does |
|---|---|
| `npm run seed:fetch` | Re-download NSE match tables into `seed-data/nse/` |
| `npm run seed:build` | Rebuild `src/data/seed/spring-26.json` and `supabase/seed.sql` from `seed-data/` |
| `npm test` | Vitest: every figure in the handoff is asserted against real data |

## How data flows

```
NSE week pages ─┐                         ┌─> engines (points, stats, scenarios, scouting)
NSE sheet CSV ──┼─> Supabase (or seed) ─> Dataset ─┤
admin entry ────┤                         └─> view-models ─> pages
ballchasing ────┘
```

Points are never stored: City's are **calculated** from round results (so the site can say
*why* a night was worth 6), and other teams' come from the NSE sheet. When the two disagree
the admin overview flags it.
