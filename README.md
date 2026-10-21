# City RL Tracker

Standings, scouting, match nights and player stats for City, University of London's two
Rocket League teams in the NSE (National Student Esports) weekly tournament:

- **City Champions**: Division 2 in Spring 26
- **City Commanders**: Swiss in Spring 26

Public to read; one admin (Ali) enters results and uploads replays. Built with Next.js 16
(App Router), Supabase (Postgres + Auth + RLS) and the ballchasing.com API, hosted on Vercel.

## Start here: current state (Winter 26, as of 21 Oct 2026)

Read this first. It answers the questions that otherwise get re-asked every session.

**Live site:** https://nse-rl-tracker.vercel.app (Vercel; every merge to `main` deploys).
Winter 26 is **already created and current** (`/winter-26/champions`, `/winter-26/commanders`),
with both rosters and two scrims entered (6 and 13 Oct). Both teams show "No results yet",
because Week 1 has not been imported. Don't re-create the season.

**Where replays go:** upload them on **our own site**, not on ballchasing: sign in at `/admin` →
*Replays* → **Sort and upload a night**. Drop every `.replay` file from the night (any names, any order,
both teams). In the browser the page reads each file's header (start time, score, players, lobby name like
`NSEMD1G2`), and:
- if the site has no results for that day yet it **fetches them from NSE itself** (`syncNseForDates` in
  `src/lib/actions/admin.ts`, the same import as *Imports → NSE matches*; there is also a "Fetch results from NSE" button);
- works out which team the files are (the series scores they add up to, else roster names, matched loosely so
  `stav1c` = "Stavic");
- puts them on the right series and game numbers by matching wins/losses to the series scores. Replays it can only
  place from the lobby round (e.g. a series with just some of its games saved) are marked **"Ready (guess)"**: check the game number.
A table shows the result for review; **Upload** then sends them one at a time through our server to ballchasing and saves the stats.
*Upload to one series* below it is the manual fallback.
Rocket League replays (`.replay`) only exist on PC (on Linux: the `Demos` folder inside the Wine/Proton prefix).
The `BALLCHASING_TOKEN` is a Vercel environment variable (server only, added 29 Sep): if it is missing, the
Replays and Admin pages show a red banner. Claude sessions cannot read Vercel env vars or sign in as admin,
so Claude cannot upload replays for Ali; it can only read them locally (`src/lib/replay/header.ts`).

**Where results come from:**
- NSE: https://nse.gg/tournaments/rocket-league-nse-winter-26 (`tournaments.nse.gg` serves the same
  pages; the importer uses that host). Pages: `/stage-1`, `/matches`, `/teams`, `/schedule`,
  later `/week-3` … `/week-6`. `parseNseMatchTable` in `src/lib/import/nse.ts` already parses
  the Winter 26 pages. Import with *Admin → Imports → NSE matches* (page `stage-1`, then `week-N`).
- Standings sheet ("Week 1 Rocket Standings"): https://docs.google.com/spreadsheets/d/1TQ7WzJ4a8Ku4Jl3hmpx9Kq5WERE3aV1euabSNfyo3To
  Tabs: **Starting groups** (Groups 1–3, by seed) and **After week 1** (Groups 1–6). It has **no
  scores or points**, only group membership. Its layout differs from the Spring 26 sheet, so
  check `src/lib/import/sheet.ts` before using the *Standings sheet* import on it.

**Winter 26 format (from NSE):** Tuesdays 7pm. Weeks 1–2 qualification ("Stage 1", 3 rounds per
night, 20 and 27 Oct), weeks 3–6 league (3, 10, 17, 24 Nov), week 7–8 playoffs (1 Dec, finals
5/6 Dec). Stage 2 splits teams into divisions; 2 are relegated and 2 promoted each week.
155 teams signed up. Seeds: City Champions 9, City Commanders 44.

**Qualification groups (inferred, not stated by NSE):** the sheet's groups look like win
counts after Week 1. "Need N more wins for Div 1" fits 4 wins over the 6 qualification
rounds for Div 1, and fewer goes to Swiss (Group 4–6 = 2 / 1 / 0 wins in Swiss).
Treat as unconfirmed until NSE or Ali says so.

**Week 1 (20 Oct) results:**

| Team | Round 1 | Round 2 | Round 3 | Group after |
|---|---|---|---|---|
| City Champions | W 3–1 NSCG Ghosts | W 3–1 Solent Cardinals | L 0–3 Durham Defenders RL | 2 (needs 2 more wins) |
| City Commanders | L 1–3 UWE Sea Stags RL | L 0–3 No Execuses | W 3–1 Leic Is More | 3 (needs 3 more wins) |

**What is not built yet** (see TODO.md): a Winter 26 ruleset in `src/lib/engine/rulesets.ts`
(Stage 1 is a wins-based qualification, not the Spring points ladder), a "wins needed for
Div 1" view for the Stage 1 dashboard, and the real-replay upload test.

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
| `scripts/` | `fetch-nse.ts` (snapshot NSE), `build-seed.ts` (sources → seed JSON + SQL) |
| `design-reference/` | Approved mockups (see docs/HANDOFF.md §11 for how to read them) |

## Docs

- [docs/setup.md](docs/setup.md): Supabase, Vercel, admin account, ballchasing token
- [docs/points-engine.md](docs/points-engine.md): how nights are scored, derived stats, scenarios, known anomalies
- [docs/data-model.md](docs/data-model.md): tables, why they look like this, RLS
- [TODO.md](TODO.md): build checklist and **open questions for Ali**
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
