# Build checklist

Goal (handoff §1): a public site on Vercel tracking City Champions and City Commanders in NSE,
read by anyone, edited only by Ali. Priorities: dashboard → scouting/head-to-head → match
detail → players.

## Phase 0: Setup
- [x] Next.js 16 app (TypeScript, App Router, Tailwind 4, ESLint), Vitest
- [ ] Create the Supabase project and link Vercel; add env vars (**needs Ali's accounts**, see docs/setup.md)
- [x] Fonts (Chakra Petch, IBM Plex Sans, IBM Plex Mono) and design tokens as CSS variables

## Phase 1: Data
- [x] Schema written up in docs/data-model.md, **including proposed changes to review**
- [x] Migration + RLS (public read, admin write, private notes). Tested on local Postgres 16 + PostgREST
- [x] Seed: season, teams, both rosters, **every** Div 2 and Swiss series (from NSE), sheet results
- [ ] Apply the migration and seed to the real Supabase project

## Phase 2: Engines (test first)
- [x] `nightPoints()`: handoff Week 3/4 fixtures, Champions 4-6-4-6, Chargers 7, every Div 2 team vs the sheet
- [x] Derived stats: series 6–7, games 25–30, Game 5s 4–2, 5.0/night, form, head-to-head
- [x] Scenarios with the pre-Week 6 table (reproduces the approved mockup)

## Phase 3: UI
- [x] Global chrome: header, nav, season selector, team switcher (keeps the page), phone tab row + menu
- [x] Dashboard: desktop and phone
- [x] Scouting: search, head-to-head, past games, their season, patterns, captain's notes (admin)
- [x] Matches: week tabs incl. Stage 1 and Playoffs, night path, series panel, game slots, scoreboards
- [x] Players: leaders, leaderboard (per game / totals), profile; placeholders until replays arrive
- [x] Full standings page (phone "Full standings" link, Swiss table with 55 teams)

## Phase 4: Admin and replays
- [x] Supabase Auth sign-in, `admins` gate (+ optional `ADMIN_EMAIL`), session refresh in `proxy.ts`
- [x] Night entry with live points preview
- [x] NSE week-page import (every team's series) with preview
- [x] Sheet CSV import (download or paste) with diff preview
- [x] ballchasing upload (sequential, 429 back-off, 409 = duplicate), polling, stat mapping, player linking
- [x] Roster management, platform IDs, upcoming night, new season
- [ ] Try a real replay upload with Ali's `BALLCHASING_TOKEN` (tested against a fake ballchasing server)

## Phase 5: Ship
- [x] Responsive check at 390 / 768 / 1440 (no horizontal scroll); axe (WCAG 2 AA) clean on all public pages
- [ ] Deploy to Vercel production
- [x] README, docs/setup.md, docs/points-engine.md, docs/data-model.md

## Open questions for Ali

Answered from NSE data during the build (please confirm):
- **Commanders' Swiss tournament** is `tournaments.nse.gg/tournaments/rocket-league-nse-spring-26`
  (Stage 1 on 3 & 10 Feb, then Weeks 3–6). Roster: Robin Ghigea, **Caprillix (leader)**, Nizar Omar, Ardi Halili.
- **Caprillix** leads both teams. Is that you? (Player pages are public right now.)
- **Division 1 ladder**: 10/7/6/4/3/0 in Week 3, then two groups: upper 15/12/11/9/8/6, lower 8/6/5/3/2/0.
- **Swiss ladder**: not a simple path ladder (2 wins scored 8 or 7, and so on), so Swiss points come
  from the sheet and Scenarios are hidden for Commanders. Do you know the Swiss rules?
- **Week 3 bye**: modelled as a Round 3 series with no opponent (the recommended option). Week 6 had byes too.
- **Sheet anomalies**: Fake Warwick (Wk 4), Swansea (Wk 5) and Lincoln (Wk 6) lost Round 3 from 1–1 but
  got 6, not 4. NSE adjustments?

Still open:
1. **Tiebreak rules** for standings (the site keeps NSE's order and says "Tiebreak rules to confirm with NSE").
2. **Playoff series lengths** per round (the Last 16 was at least best-of-7; the site infers best-of from scores).
3. **Branding**: City Esports official colours and logo (gold `--accent` in `globals.css` is a placeholder).
4. **Replays**: who on each team is on PC and can supply `.replay` files?
5. **Champions' Swiss Stage 1** (3 & 10 Feb, including a 3–0 over Commanders): it's in the database but not
   shown on the Champions (Div 2) dashboard. Show it?
6. **Data model changes** in docs/data-model.md ("Changes from the handoff"), especially neutral series.
7. **Scraping NSE**: the admin has a one-click "Import from NSE" per week. Is that enough, or do you want it scheduled?
8. **Mid-season tier moves**: `team_seasons.tier` (which table a team is tracked in) can only be changed in SQL for now.

## Nice-to-haves (not started)
- Cache public pages (e.g. `revalidate` + `revalidateTag` on admin writes) if traffic grows
- ballchasing groups per series
- Replay insights in scouting (top scorer vs City, shots, saves)
