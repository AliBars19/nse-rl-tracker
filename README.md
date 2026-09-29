# City RL Tracker

Standings, scouting, match nights and player stats for City, University of London's two
Rocket League teams in the NSE (National Student Esports) weekly tournament:

- **City Champions**: Division 2 in Spring 26
- **City Commanders**: Swiss in Spring 26

Public to read; one admin (Ali) enters results and uploads replays. Built with Next.js 16
(App Router), Supabase (Postgres + Auth + RLS) and the ballchasing.com API, hosted on Vercel.

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
| `src/app/admin/…` | Admin: sign in, nights, replays, imports, roster, upcoming night |
| `src/app/api/admin/replays/…` | Replay upload → ballchasing, and processing (polling) |
| `src/lib/engine/` | **Pure logic, fully tested**: points, nights, stats, standings, scenarios, scouting, players |
| `src/lib/import/` | NSE HTML parser, standings-sheet CSV parser, name matching |
| `src/lib/ballchasing/` | ballchasing client and replay → stats mapping |
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
