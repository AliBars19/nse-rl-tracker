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
