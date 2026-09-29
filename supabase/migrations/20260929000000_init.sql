-- City RL Tracker: initial schema.
-- See docs/data-model.md for the reasoning behind each table.
--
-- Access model (RLS):
--   * everyone (anon) can SELECT everything except scouting_notes and admins
--   * only users listed in `admins` can INSERT/UPDATE/DELETE
--   * scouting_notes are admin-only for every operation

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ enums
create type tier as enum ('div1', 'div2', 'swiss');
create type stage as enum ('placement', 'league', 'playoff');
create type playoff_round as enum ('last32', 'last16', 'qf', 'sf', 'final');
create type night_status as enum ('played', 'promoted_in', 'relegated_in', 'promoted_out', 'relegated_out', 'absent');
create type roster_role as enum ('leader', 'player', 'sub');

-- ------------------------------------------------------------------ seasons + teams
create table seasons (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                     -- 'spring-26'
  name text not null,                            -- 'NSE Spring 26'
  short_name text not null,                      -- 'Spring 26'
  is_current boolean not null default false,     -- where '/' redirects to
  is_finished boolean not null default false     -- "Finished 6th" vs "Currently 6th"
);
create unique index seasons_single_current on seasons (is_current) where is_current;

create table teams (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                     -- URL: /spring-26/champions/scouting/<slug>
  name text not null,                            -- 'Royal Bears Rocket league'
  short_name text not null,                      -- 'Royal Bears'
  nse_slug text unique,                          -- NSE team slug
  our_key text unique check (our_key in ('champions', 'commanders'))  -- null for opponents
);

-- Which tier's table a City team is tracked in for a season.
create table team_seasons (
  season_id uuid not null references seasons(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  tier tier not null,
  nse_tournament_slug text,
  primary key (season_id, team_id)
);

-- ------------------------------------------------------------------ nights + series
-- A scoring unit for one tier: a weekly league night, or Swiss Stage 1.
create table nights (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  tier tier not null,
  stage stage not null check (stage <> 'playoff'),
  week int not null,                             -- sort order; Stage 1 = 1
  label text not null,                           -- 'Week 3' | 'Stage 1'
  date date not null,
  venue text,
  unique (season_id, tier, week)
);

-- One best-of-N series, stored neutrally (home/away) so every team's path through a
-- night can be rebuilt. away_team_id null = bye. Points are never stored here: they are
-- calculated from the round results (src/lib/engine/points.ts).
create table series (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  tier tier not null,
  nse_match_id int unique,
  stage stage not null,
  night_id uuid references nights(id) on delete cascade,
  round int check (round between 1 and 9),       -- 1..3 league, 1..6 Stage 1, 4 = Swiss promotion match
  playoff_round playoff_round,
  home_team_id uuid not null references teams(id),
  away_team_id uuid references teams(id),
  home_score int check (home_score >= 0),
  away_score int check (away_score >= 0),
  best_of int not null default 5 check (best_of in (1, 3, 5, 7, 9)),
  is_forfeit boolean not null default false,     -- counts for points, excluded from game stats
  played_at timestamptz,
  check ((stage = 'playoff') = (night_id is null)),
  check ((stage = 'playoff') = (playoff_round is not null)),
  check (away_team_id is null or away_team_id <> home_team_id),
  check (away_team_id is not null or (home_score is null and away_score is null))
);
create index series_night_idx on series (night_id);
create index series_home_idx on series (home_team_id);
create index series_away_idx on series (away_team_id);

-- ------------------------------------------------------------------ standings sheet imports
-- One cell of the NSE standings sheet: other teams' weekly points (we only know their totals).
create table external_night_results (
  night_id uuid not null references nights(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  points int,
  status night_status not null default 'played',
  primary key (night_id, team_id)
);

-- One row of a sheet tab: NSE's own ordering (it breaks ties we cannot explain yet).
create table external_standings (
  season_id uuid not null references seasons(id) on delete cascade,
  tier tier not null,
  team_id uuid not null references teams(id) on delete cascade,
  position int,                                  -- null = left the tier
  total int,
  playoff_note text,                             -- 'Bye Round 1 and 2'
  primary key (season_id, tier, team_id)
);

-- ------------------------------------------------------------------ players
create table players (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nickname text not null,
  nse_profile_url text,
  platform_ids jsonb                             -- {"steam": "7656...", "epic": "..."} to match replays
);

create table roster_entries (
  team_id uuid not null references teams(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  role roster_role not null default 'player',
  primary key (team_id, season_id, player_id)
);

-- ------------------------------------------------------------------ replays
-- One uploaded replay = one game. processed_at is null until ballchasing has parsed it.
create table games (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references series(id) on delete cascade,
  game_number int not null check (game_number >= 1),
  ballchasing_id text unique,
  ballchasing_status text,                       -- 'pending' | 'ok' | 'failed'
  home_goals int,
  away_goals int,
  overtime boolean,
  raw jsonb,                                     -- full ballchasing response, for stats we add later
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (series_id, game_number)
);

create table player_game_stats (
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid references players(id) on delete set null,  -- null until linked by the admin
  team_id uuid references teams(id),
  display_name text not null,                    -- name in the replay
  platform text,                                 -- 'steam' | 'epic' | ...
  platform_id text,
  score int, goals int, assists int, saves int, shots int,
  mvp boolean,
  extra jsonb,                                   -- boost, positioning, ... for later
  primary key (game_id, display_name)
);
create index player_game_stats_player_idx on player_game_stats (player_id);

-- ------------------------------------------------------------------ admin-entered context
-- Next night's Round 1 draw, for the dashboard Scenarios section.
create table upcoming_nights (
  season_id uuid not null references seasons(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  tier tier not null,
  week int not null,
  date date,
  r1_opponent_id uuid references teams(id),      -- null = TBC
  primary key (season_id, team_id)
);

create table scouting_notes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,        -- which City team wrote it
  opponent_id uuid not null references teams(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text
);

-- ------------------------------------------------------------------ RLS
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'seasons', 'teams', 'team_seasons', 'nights', 'series', 'external_night_results',
    'external_standings', 'players', 'roster_entries', 'games', 'player_game_stats', 'upcoming_nights'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "public read" on %I for select using (true)', t);
    execute format('create policy "admin insert" on %I for insert to authenticated with check (public.is_admin())', t);
    execute format('create policy "admin update" on %I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('create policy "admin delete" on %I for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- Captain's notes: private to admins for every operation.
alter table scouting_notes enable row level security;
create policy "admin all" on scouting_notes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Admins can see their own row (so the app can check "am I an admin?"). Rows are
-- added by hand in the SQL editor; there is no insert policy on purpose.
alter table admins enable row level security;
create policy "see self" on admins for select to authenticated using (user_id = auth.uid());
