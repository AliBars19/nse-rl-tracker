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
- **ballchasing replay pages have tabs**, and their own menu link for the 3D viewer is `#watch` (`/replay/<id>#watch`); there is no separate viewer URL.
  Unlisted replays open for anyone with the link; private ones only for the owner.
- **`player_game_stats.extra`** holds ballchasing's per-player `boost`, `movement`, `positioning` and `demo` groups (field names in
  https://ballchasing.com/doc/api). They are pulled out with PostgREST JSON paths (`bpm:extra->boost->bpm`) in `loadGameExtras`, kept out of the main
  dataset query so a bad path cannot take the site down.
- **ballchasing free accounts**: 10 uploads per rolling 24 h by default (20 max, 70 per week). See docs/setup.md.
- **ballchasing's 3D viewer needs a sign-in for signed-out visitors** ("Sign in to generate these visualizations"; the viewer sits on "Loading…").
  `#watch` does open the viewer tab, but the data is generated on demand. The site says so next to the button.
- **Replay analysis beyond ballchasing**: the full replay can be parsed locally with `subtr-actor-py` (possession, boost, rotations, kickoffs, shots,
  frame-by-frame positions); the `boxcars-py` on PyPI is too old for current replays. Boost there is on a 0–255 scale.
- **A typo in `BALLCHASING_VISIBILITY` used to break every upload** ("invalid visibility" from ballchasing): the raw Vercel value was passed straight through and the
  `?? "unlisted"` fallback only covers a missing variable. `parseVisibility()` in `src/lib/env.ts` now normalises it.
- **ballchasing's public replay pages carry the team/player stat tables but not the timeline** (`Sign in to generate the game timeline`), and replay downloads need a login.
  Quick write-ups can use the page tables; goal-by-goal needs the raw files from Ali. See docs/analysis.md. Link order on the site's Matches page is game order: don't `sort -u` the ids.
- **ballchasing `Possession` and subtr-actor's possession differ**; kickoff "possession" is a parser label. Quote them as guidance, not as exact figures.
- **ballchasing free quota** is about 10 uploads per rolling 24h (raise the setting to 20, 70 a week): a 11-game night needs two days.
- **A Claude cloud session cannot read Vercel env vars, sign in as admin, or download from ballchasing**: Ali does uploads and sends zips; Claude reads the live site and ballchasing's public pages.
- **Don't merge on a green-looking dashboard alone**: Vercel builds sometimes lag 7–12 minutes, and production deploys of merge commits sometimes need a manual `create_deployment` (gitSource github, ref main, target production).
- **NSE rosters list the NSE nickname, not the in-game name**: matching opponents' in-game names against NSE team pages (Winter 26: 155 teams, Spring 26: 110 + 31 in Division 2) found nothing; ask for the replay or the player's name instead.
- **A City team can be in a different NSE tournament each week** (Winter 26: Champions in Division 1, Commanders in the Swiss, both on Tuesday 3 Nov). The replay sorter used to look only in the tournament stored for each team and called a day "known" if either team had a series that night, so Champions' replays were "not detected". It now looks in every tournament of the season and fetches a night when either team is missing it.
- **NSE publishes the weekly points as headings in the "Points" round of each week page** (`Upper Division 1 - 10 Points`, `8 Swiss Points`, `Promoted to Division 1`). The match rows in that round are 1–0 against a Bye and look like admin noise, which is why the importer skipped them for weeks and the site had no points: always read the headings. Four teams are promoted and four demoted each week (not two). Swiss points vary by pod (Group 1/2).
- **NSE's Stage 1 page (`/stage-1`) answers 403 once Stage 1 is over**: import what you need while it is live (the fixture in `seed-data/nse` is night 1 only).
