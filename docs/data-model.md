# Data model

Schema: `supabase/migrations/20260929000000_init.sql`. TypeScript mirror: `src/lib/domain/types.ts`.
The app loads one season as a single `Dataset` (a few hundred rows) and derives everything in
code, so there are no stored totals to drift out of sync.

## Tables

| Table | Holds | Notes |
|---|---|---|
| `seasons` | `spring-26`, name, `is_current`, `is_finished` | one current season (partial unique index) |
| `teams` | every team we've seen, ours and opponents | `our_key` = `champions` / `commanders` for City; `slug` for URLs; `nse_slug` to match NSE pages |
| `team_seasons` | which tier's table a City team is tracked in, per season, plus its NSE tournament slug | |
| `nights` | one **scoring unit** per tier: a weekly night, or Swiss Stage 1 | `week` is the sort order and standings column (Stage 1 = 1) |
| `series` | one best-of-N, **stored neutrally** (home/away) | `away_team_id` null = bye; `is_forfeit`; `round` 1–3 (1–6 Stage 1, 4 = Swiss promotion match); `playoff_round` for playoffs |
| `external_night_results` | one cell of the NSE sheet: points and/or a status | status: `played`, `promoted_in`, `relegated_in`, `promoted_out`, `relegated_out`, `absent` |
| `external_standings` | one row of a sheet tab: NSE's position, total, playoff note | NSE's order breaks ties we can't explain yet |
| `players`, `roster_entries` | people, and who is on which City team each season | `platform_ids` (`{"steam": "…", "epic": "…"}`) match replays |
| `games` | one uploaded replay | `ballchasing_id`, `home_colour`, goals, `raw` (full ballchasing JSON), `processed_at` null until parsed |
| `player_game_stats` | per-player core stats per game | `player_id` null until linked; `extra` keeps boost/movement/etc. for later |
| `upcoming_nights` | next night's week + Round 1 opponent, per City team | feeds Scenarios |
| `scouting_notes` | captain's notes | admin-only |
| `admins` | who may write | rows added by hand in SQL |

## Changes from the handoff's proposed schema (please review, Ali)

1. **Series are neutral (home/away), not "ours vs opponent".** The approved Scouting design
   shows each opponent's own weekly path ("1–1, won decider"), and "They reached the 1–1
   decider every single week" needs other teams' rounds. Storing series neutrally lets us
   import whole NSE week pages (every team) and derive anyone's night. Admin night entry still
   works with only City's rows. `result` is derived from the scores, not stored.
2. **Ladders live in code** (`src/lib/engine/rulesets.ts`), not a `rulesets` table. They
   change rarely, get unit-tested, and carry notes on how sure we are. The handoff allowed either.
3. **`nights.stage` + `label`** so Swiss Stage 1 (two evenings, scored once) fits as one night.
4. **`external_standings`** added: the sheet's order and playoff notes aren't recoverable
   from weekly cells (Chargers Green and City are both on 20, NSE lists Chargers 5th).
5. **Statuses are tab-relative**: "Promoted to Div 1" in the Division 2 tab means the team
   left (`promoted_out`); in the Division 1 tab it means they arrived (`promoted_in`).
6. `teams.slug`, `players.slug` for URLs; `seasons.is_current/is_finished`; `games.home_colour`;
   `upcoming_nights`; `scouting_notes.team_id` (which City team wrote it).

## Computed vs imported points

- **City**: calculated from `series` with the tier's ladder, so the site shows *why*.
- **Everyone else**: taken from `external_night_results` (the sheet).
- **Cross-check**: when both exist and differ, `TeamNight.mismatch` is set. The admin
  overview shows it for City; three historical opponent anomalies are listed in
  docs/points-engine.md.

## RLS

- `select` is public on everything except `scouting_notes` and `admins`.
- `insert` / `update` / `delete` only when `public.is_admin()`, which is true when
  `auth.uid()` is in `admins`.
- `scouting_notes`: admin-only for every operation.
- `admins`: a signed-in user can read only their own row (so the app can ask "am I an
  admin?"); there is no insert policy.

Verified locally against Postgres 16 + PostgREST: anon can read series but not notes and
cannot write; a signed-in non-admin cannot insert or update; the admin can.

## Sources

| Source | Used for | How |
|---|---|---|
| NSE week pages (`/week-N`, `/stage-1`) | every series | server-rendered HTML → `src/lib/import/nse.ts` |
| NSE team match lists | playoff rows (bracket pages are JS-only) | same parser |
| NSE standings Google Sheet (CSV export per tab) | other teams' weekly points, order, playoff notes | `src/lib/import/sheet.ts` |
| ballchasing.com | per-game player stats | `src/lib/ballchasing/` |

Tournament slugs for Spring 26: Division 2 `rocket-league-nse-spring-26-division-2`,
Swiss `rocket-league-nse-spring-26` (Stage 1 + Weeks 3–6), Division 1
`rocket-league-nse-spring-26-division-1`.
