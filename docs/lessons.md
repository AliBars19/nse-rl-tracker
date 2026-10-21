# Lessons from the build

Things that went wrong once and how they were fixed, so nobody has to rediscover them.

## Next.js 16 / Turbopack / Tailwind 4
- **`next/font/google` broke the Vercel build** under Turbopack ("queries have exactly one entry"). Fonts are self-hosted woff2 files in `src/app/fonts` (with their OFL licences) and loaded with `next/font/local`.
- **Base styles must live in `@layer base`.** An unlayered `a { color }` in `globals.css` beat every Tailwind utility class.
- **Don't override `--breakpoint-*` inside `@theme inline`**: it broke the `xl` breakpoint.
- **`npm run typecheck` runs `next typegen` first.** `PageProps` / `LayoutProps` are generated types; after deleting `.next`, plain `tsc` fails without them.
- **Loading overlay:** `onRouterTransitionStart` (in `src/instrumentation-client.ts`) runs inside the router transition, so setting state there never paints. It is deferred with `setTimeout(..., 0)`.
- Read `node_modules/next/dist/docs/` before using a Next API: this version differs from older docs (`proxy.ts` instead of middleware, async `params`, `unstable_rethrow`).

## Data and admin
- **Creating a new current season must finish the previous one.** It didn't at first, so Spring 26 stayed "in progress" after Winter 26 was created (fixed in PR #5, and the live row was corrected). The Seasons list on the Admin overview can mark any season finished / in progress or make it current.
- **Database changes (migrations) are run by Ali in the Supabase SQL Editor.** Claude sessions can't reach the project through the Supabase connector. Run every file in `supabase/migrations/` in name order on a fresh project.
- **Scrims** need `20261011000000_scrims.sql` (applied to the live project on 2026-10-17). Without it, saving a scrim shows an error naming that file.
- **ballchasing:** the token allows about 10 uploads per 24 h; a 409 "duplicate" counts as success. Replays only exist on PC, and only after Save Replay is pressed in game.
- **NSE rosters list real names, not in-game names.** In-game names only come from replays (link them to roster players once on Admin, Replays).

## Decisions made with Ali
- The admin is the City address (`ADMIN_EMAIL`), not the Gmail account.
- PRs may be merged automatically once the Vercel check is green and there are no conflicts (also in `CLAUDE.md`).
- `/` is a season picker; switching season or team keeps the current page.
- Scrims count towards player stats only, never points, records, form or scouting.
- No service-role key in the app or in Vercel; the Supabase secret key should be rotated (it was pasted into a chat once).

## Replay files (found reading real Winter 26 replays, 21 Oct 2026)

- **File names are hashes and file dates are unreliable** (zipping or copying resets them). Everything needed is in the
  replay header: `MatchStartEpoch` (start time, UTC), `Team0Score`/`Team1Score` (**omitted when 0**), `PlayerStats`, `MapName`.
  Sorting reads that (`src/lib/replay/header.ts`), never file dates.
- **The person hosting a private lobby is listed as a player with `Team = -1`** (here Caprillix, all zeros). Drop them; they are not on either team.
- **`ReplayName` is the lobby name**: NSE lobbies are `NSEMD<match day>G<round>` (e.g. `NSEMD1G2` = match day 1, round 2). Used only as a
  tie-breaker, because both City teams' lobbies carry the same name.
- **In-game names do not match roster nicknames** (`stav1c` vs "Stavic", `yam.een` vs "Yameen"), so City's side is found by roster names
  if any match, otherwise by who keeps appearing across the night's replays (opponents change each series). A single replay with no roster match
  cannot be placed: set its colour by hand.
- **Header quirk:** byte properties are either an enum name + enum value, or `None` + one raw byte (PlayStation IDs use the latter).
- Both City teams play at the same time, so a night's replays are assigned to whichever team's series scores they add up to
  (e.g. Champions 3–1, 3–1, 0–3 vs Commanders 1–3, 0–3, 3–1 are different win/loss tallies over the same 11 games).
- **Sorting without the night's results is impossible** (series scores are what the replays are matched against), so the sorter fetches the NSE
  `stage-1` / `week-N` pages for the days it sees (`syncNseForDates`). Pages that are not published yet 404; that is skipped, not an error.
- **NSE match pages list both rosters by NSE nickname** (`/matches/<id>`: e.g. `kid`, `stav1c`, `yams`), which only loosely match in-game names
  (`kidwys`, `yam.een`), and NSE profile pages carry no Epic/Steam IDs. So roster evidence uses the site roster with loose matching
  (`src/lib/replay/names.ts`): `sameName` (strict, for attributing stats) vs `looseName` (prefix/contains, for deciding which side was City only).
- **A lone replay cannot be fitted by score** (a series needs all its games). It is placed from the lobby round if exactly one series that day has
  that round, and flagged as a guess.

