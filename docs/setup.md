# Setup: Supabase, Vercel, admin, ballchasing

The site works without any of this (read-only, bundled Spring 26 data). Follow these steps
to get the live database and the admin area.

## 1. Create the Supabase project

1. supabase.com → New project. Any region near the UK (e.g. `eu-west-2`).
2. **SQL Editor** → paste `supabase/migrations/20260929000000_init.sql` → Run.
   (Or with the Supabase CLI: `supabase link` then `supabase db push`.)
3. Load Spring 26: run `supabase/seed.sql` the same way. It is ~250 KB; if the editor
   struggles, use psql with the connection string from Project Settings → Database:
   ```bash
   psql "$DATABASE_URL" -f supabase/seed.sql
   ```

## 2. Create the admin account

1. **Authentication → Users → Add user**: Ali's email + a password (tick *Auto confirm*).
2. **Authentication → Providers → Email**: turn **off** "Allow new users to sign up", so
   nobody else can create an account.
3. SQL Editor:
   ```sql
   insert into admins (user_id, email)
   select id, email from auth.users where email = 'ali@example.com';
   ```
   Only rows in `admins` can write (RLS). There is deliberately no way to add admins from the site.

## 3. Environment variables (Vercel → Settings → Environment Variables, and `.env.local`)

| Name | Where from | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | same page ("anon" / "publishable" key) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` also works |
| `BALLCHASING_TOKEN` | ballchasing.com → Upload tab → API token | server only |
| `BALLCHASING_VISIBILITY` | optional: `public` / `unlisted` / `private` | default `unlisted` |
| `ADMIN_EMAIL` | optional | extra gate: only this email can use `/admin` |

No service-role key is needed: admin writes run as the signed-in admin and RLS checks them,
so there is no all-powerful key sitting on the server.

## 4. Deploy to Vercel

1. vercel.com → Add New → Project → import `AliBars19/nse-rl-tracker`. Framework: Next.js (auto).
2. Add the environment variables above (Production + Preview).
3. Deploy. `/` redirects to the current season's Champions dashboard.

## 5. Weekly routine (during a season)

1. **Before the night**: Admin → *Upcoming* → set the week and Round 1 opponent (from the NSE
   draw). The dashboard's Scenarios switch to a live preview.
2. **After the night**, either:
   - Admin → *Imports* → **NSE matches** → page `week-N` → Fetch & preview → Import
     (brings in every team's series, so scouting stays rich), or
   - Admin → *Nights* → type City's three results (live points preview).
3. Admin → *Imports* → **Standings sheet** → Fetch & preview → Apply (other teams' points).
4. Admin → *Replays* → pick each series → drop the `.replay` files → Upload. Link any
   unmatched names to roster players once; after that they match automatically.
5. Admin → *Upcoming* → set next week (or Clear when the league ends).

## Replays

Replay files only exist on **PC**: console players cannot export `.replay` files, so someone
on PC on each team needs to save them (BakkesMod can auto-upload). Uploads go through our
server one file at a time (Vercel caps request bodies at ~4.5 MB; replays are ~1–2 MB),
then the page polls ballchasing until the replay is parsed. A 409 "duplicate" from
ballchasing is treated as success.

## New season

Admin → Overview → **New season**: name, slug, each team's starting tier and NSE tournament
slug. Rosters are copied over. Then add a ruleset for the new season in
`src/lib/engine/rulesets.ts` if the ladders changed (otherwise the latest known one is reused
and marked "derived"), and check the sheet column layout in `src/lib/import/sheet.ts`.
