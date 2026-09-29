# City RL Tracker: Claude Code Handoff

> Read this whole file before writing any code. It contains every decision, rule, data point and design spec from the planning session. Anything marked **OPEN** is still undecided: ask Ali before assuming.

---

## 0. How to work with Ali on this build

- Ali (team captain, CS student) owns this project. He prefers to **understand the logic before implementation**. Before each phase, briefly explain the approach and why, then build.
- He works best from **a stated goal plus an explicit checklist**. Keep a running checklist (in this file's Section 14 or a `TODO.md`) and tick items off.
- He values **thorough documentation**. Keep a `README.md` and `docs/` up to date as you go, especially the points engine and the data model.
- When a decision is genuinely his (branding, what to show publicly, schema trade-offs), ask. Don't silently decide.

---

## 1. Goal

A public website, hosted on **Vercel**, that tracks City, University of London's two Rocket League teams in the **NSE (National Student Esports)** weekly tournament:

- **City Champions**: Division 2 in Spring 26
- **City Commanders**: Swiss tier in Spring 26

The site is **public to read, but only Ali can edit** (admin login). Data gets in two ways:

1. **Series results**, entered by hand after each league night (which rounds, which opponent, series score).
2. **Replay files**, uploaded through the admin UI and sent to the **ballchasing.com API**, which returns per-player stats.

**Priorities, in order:**
1. Team dashboard (standings, points, form, scenarios)
2. Opponent scouting and head-to-head
3. Match / series detail
4. Player profiles and leaderboards

Desktop and phone matter equally. The look is a **dark esports broadcast style (RLCS-like)**. The design is finished and approved (Section 9, plus `design-reference/`).

---

## 2. Decisions already made

| Decision | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router, TypeScript)** on Vercel | Server routes keep API keys private; good Vercel fit |
| Database / auth | **Supabase** (Postgres + Auth) | Row-level security gives public read and admin write |
| Replay stats | **ballchasing.com API**, called server-side only | Does replay parsing for us |
| Points | **Store each night's round results; calculate points in code** | No out-of-sync totals; the site can show *why* a team got 7 vs 6 |
| Replay data | **Copy stats into our DB and also keep the raw JSON** (`jsonb`) | Speed, rate limits, resilience if ballchasing is down, and new stats can be computed later without re-uploading |
| Access | Public read, single admin write | Ali's call |
| Team switcher | On **every** page, top of content | Ali's call |
| Season selector | Top-right of the header | Ali's call |
| Captain's notes | Keep, but **collapsed** to a one-line "Add note" bar on scouting; admin-only | Ali rarely expects to use it |

---

## 3. NSE competition format and points rules

### 3.1 Weekly league night (Division 2, confirmed against real data)

Nights are **Tuesdays**. Each night is a three-round mini Swiss of **best-of-5 series**. Kick-off times seen: R1 19:15, R2 20:00, R3 20:45. A fourth "Points" entry at 22:45 is an admin record (team vs "Bye", 1–0), **not a real match: ignore it on import.**

- **Round 1 ("Opener"):** everyone plays.
- **Round 2:** Round 1 winners play each other (**Winners' match**), and Round 1 losers play each other (**Losers' match**).
- **Round 3:** 2–0 teams play each other (**Promotion match**), 1–1 teams play each other (**Decider**), and 0–2 teams play each other (**Relegation match**).

### 3.2 Points ladder (Division 2)

| Path through the night | Points | Also |
|---|---|---|
| 2–0, win Round 3 | **10** | Promoted to Division 1 |
| 2–0, lose Round 3 | **7** | |
| 1–1, win Round 3 | **6** | |
| 1–1, lose Round 3 | **4** | |
| 0–2, win Round 3 | **2** | |
| 0–2, lose Round 3 | **0** | Relegated to Swiss |

**Verified exactly** against every City Champions week (4 + 6 + 4 + 6 = 20) and against other teams in Weeks 3 and 4.

**Exception, Week 3:** the four 2–0 teams got a **Round 3 bye** and were all promoted with 10 points. The engine must support "Round 3 = bye", scored as the promotion outcome. **OPEN:** model this as a per-night flag (for example `r3_bye_for_2_0 = true`) or as a Round 3 row with a null opponent. The recommendation is a nullable opponent plus a `result = 'bye'` value.

**Forfeits:** a series recorded as **1–0 in a best-of-5** is almost certainly a forfeit (for example Champions 1–0 Fake Warwick, Week 4). It counts as a win for points. Flag it `is_forfeit` and **exclude it from game-level stats**.

**Promotion and relegation are mid-season.** Teams move between Div 1, Div 2 and Swiss week to week, so a team's division is **per night**, not per season.

### 3.3 Other tiers (OPEN: not verified)

- **Division 1:** the top weekly score is 15, and 12, 11, 9, 8, 7, 6, 5, 3, 2 all appear. It's clearly a different ladder. Derive it from Div 1 week pages before implementing.
- **Swiss:** values like 10, 8, 7, 5, 3 appear. Commanders scored **8 every week**. Derive the ladder from Swiss match pages.
- **Design implication:** points ladders must be **data-driven per tier** (a `rulesets` table or a TS config keyed by tier and season), not hard-coded to Div 2.

### 3.4 Playoffs

- Seeding by league points. From the Division 2 sheet, **ranks 1–4 get byes in Rounds 1 and 2**, and **ranks 5–8 get a bye in Round 1**. (The source spreadsheet labels these "Bye Round 1 and 2" and "Bye Round 1".)
- Div 2 bracket rounds: Last 32, Last 16, Quarter Final, Semi Final, Final. Seen on 17 and 24 Mar 2026.
- Playoff series can be longer: Champions lost the Last 16 **2–4**, so at least best-of-7. **OPEN:** confirm the format per round.
- Division 1 has separate "Playoff Group 1/2/3" brackets.

### 3.5 Tiebreaks: **OPEN**

Unknown. The scenarios UI currently says "Tiebreak rules to confirm with NSE." Treat ties as ties until confirmed.

---

## 4. Data sources

| Source | URL / access | Notes |
|---|---|---|
| NSE Div 2 tournament | `https://tournaments.nse.gg/tournaments/rocket-league-nse-spring-26-division-2` | Sub-pages: `/playoffs`, `/week-3` … `/week-6`, `/teams/<slug>`, `/teams/<slug>/matches`, `/matches/<id>`. The `/rules` page 404s. The overview is JS-rendered and empty to scrapers. |
| City Champions team | `…/teams/city-champions` and `…/teams/city-champions/matches` | Roster and full match list, fetchable as HTML |
| NSE standings spreadsheet (Google Sheet, public) | `https://docs.google.com/spreadsheets/d/1obgH4V6-QKiJsIEeBDrtlSibw3XbBlEcq3_6XPuREzg` | Tabs: **Division 1** gid `915740849`, **Division 2** gid `427419427`, **Swiss** gid `2071657847`. CSV export works: `…/export?format=csv&gid=<gid>` |
| Swiss tournament (Commanders) | **OPEN: URL not found.** Tried `…-spring-26-swiss`, `-swiss-stage`, `-division-3`, `-open`, etc. (all 404). The City org page lists no teams. | Ask Ali for any Commanders match or team link |
| ballchasing.com | `https://ballchasing.com/api/`, docs at `https://ballchasing.com/doc/api` | See Section 8 |

**Spreadsheet quirks:** numeric week columns also contain text ("Promoted to Div 1", "Demoted to Div 2", "Demoted to Swiss", "Promoted to Div 2"), and teams can appear in more than one tab. The Swiss header row is misaligned (header says Stage 1, Wk3, Wk4, Wk5, Total, but there are five weekly values plus a total). **Parse defensively**: a status cell is an event, not points.

Raw CSV copies of all three tabs (as downloaded on 29 Sep 2026) are in `seed-data/`.

---

## 5. Data gathered (seed data)

### 5.1 City Champions: roster (NSE)

| Nickname | NSE role |
|---|---|
| Caprillix | Leader |
| Yams | Player |
| kid | Player |
| Matte | Player |
| Wasil Barits | Player |

Profile links are on the team page. **OPEN:** which nickname is Ali's; Commanders roster.

### 5.2 City Champions: every series, Spring 26 Div 2

| NSE ID | Date | Week | Round | Opponent | City–Opp | Result | Notes |
|---|---|---|---|---|---|---|---|
| 178799 | 17 Feb | 3 | R1 Opener | Lincoln Swans | 1–3 | L | |
| 178811 | 17 Feb | 3 | R2 Losers' | UCL Huzzlingtons | 3–2 | W | |
| 178822 | 17 Feb | 3 | R3 Decider | Royal Bears Rocket league | 1–3 | L | Night: **4 pts** |
| 180116 | 24 Feb | 4 | R1 Opener | Fake Warwick | 3–2 | W | |
| 180117 | 24 Feb | 4 | R2 Winners' | Chargers Green | 2–3 | L | |
| 180130 | 24 Feb | 4 | R3 Decider | Fake Warwick | 1–0 | W | **Forfeit.** Night: **6 pts** |
| 181242 | 3 Mar | 5 | R1 Opener | Royal Bears | 1–3 | L | |
| 181253 | 3 Mar | 5 | R2 Losers' | Keele Krakens 2nd 2025 | 3–0 | W | |
| 181257 | 3 Mar | 5 | R3 Decider | Sussy Staffordians | 2–3 | L | Night: **4 pts** |
| 182310 | 10 Mar | 6 | R1 Opener | Trent Thunders | 3–2 | W | |
| 182315 | 10 Mar | 6 | R2 Winners' | Nottthemainteam | 1–3 | L | |
| 182350 | 10 Mar | 6 | R3 Decider | Royal Bears | 3–2 | W | Night: **6 pts** |
| 183232 | 17 Mar | PO | Last 32 | Bye | — | — | Seeded bye (6th place) |
| 183241 | 17 Mar | PO | Last 16 | Portsmouth Pirates | 2–4 | L | Eliminated |

(Points-bye admin rows 178833, 180140, 181272 and 182360 are ignored.)

**Derived figures (all shown in the design):**
- Final: **6th of 16, 20 pts** (Chargers Green also has 20 and is listed 5th; tiebreak unknown)
- Series: **6–7** (includes one forfeit win)
- Games: **25–30** (forfeit excluded; includes the playoff 2–4)
- Game 5s (series that went 3–2 either way): **4–2**
- Average points per night: **5.0** (best 6, worst 4)
- Form, newest first: L 2–4 Portsmouth Pirates, W 3–2 Royal Bears, L 1–3 Nottthemainteam, W 3–2 Trent Thunders, L 2–3 Sussy Staffordians

**Head-to-head, series W–L:** Royal Bears 1–2 (games 5–8), Fake Warwick 2–0 (one forfeit), Lincoln Swans 0–1, UCL Huzzlingtons 1–0, Chargers Green 0–1, Keele Krakens 2nd 1–0, Sussy Staffordians 0–1, Trent Thunders 1–0, Nottthemainteam 0–1, Portsmouth Pirates 0–1.

### 5.3 Division 2 final standings (from the sheet)

| Pos | Team | Wk3 | Wk4 | Wk5 | Wk6 | Total | Playoffs |
|---|---|---|---|---|---|---|---|
| 1 | Lincoln Swans | 10 | 10 | 10 | 6 | 36 | Bye R1+R2 |
| 2 | Nottingham | 10 | 10 | 10 | 0 | 30 | Bye R1+R2 |
| 3 | Trent Thunders | 10 | 6 | 6 | 2 | 24 | Bye R1+R2 |
| 4 | Portsmouth Pending | 4 | 6 | 6 | 6 | 22 | Bye R1+R2 |
| 5 | Chargers Green | promoted in | 7 | 7 | 6 | 20 | Bye R1 |
| 6 | **City Champions** | 4 | 6 | 4 | 6 | 20 | Bye R1 |
| 7 | Sussy Staffordians | 2 | 4 | 6 | 6 | 18 | Bye R1 |
| 8 | Royal Bears Rocket league | 6 | 4 | 4 | 4 | 18 | Bye R1 |
| 9 | Keele Krakens 2nd 2025 | 4 | 2 | 2 | 2 | 10 | |
| 10 | Womp womp Leeds stomp stomp | — | promoted in | 2 | 4 | 6 | |
| 11 | Portsmouth Pirates | — | — | promoted in | 4 | 4 | |
| 12 | My Poor Decals | demoted | — | promoted in | 0 | 0 | |
| 13–16 | MMU Minotaurs, UWE Sea Stags, Brighton Bears, WinchesterWarriors RL | — | — | — | promoted in | 0 | |

**Pre-Week 6 totals** (used for the Scenarios mockup): Lincoln 30, Nottingham 30, Trent 22, Portsmouth Pending 16, **City 14**, Chargers 14, Royal Bears 14, Sussy 12, Keele 2nd 8. City was **joint 5th**.

### 5.4 City Commanders (Swiss)

- **8th of 55, 40 pts**, scoring **8 in every one of five weeks** (per the Swiss tab). Never promoted.
- Top of the Swiss table: Keele Krakens 2025 (48), Warwick No WiFi (47), The Cabin (46), UCL Huzzlingtons (44).
- **No match-level data yet (OPEN).**

### 5.5 Reference fixtures for tests: Division 2 Weeks 3 and 4

**Week 3 (17 Feb)**

- **R1:** City 1–3 Lincoln; My Poor Decals 0–3 White Rose Rockets; Sussy 0–3 Essex Blades A; Swansea Storm 2–3 Keele 2nd; Portsmouth Pending 1–3 Megalodon Sharks; Fake Warwick 1–3 BU Barracudas; Warwick No WiFi 2–3 Nottthemainteam; UCL 0–3 Royal Bears.
- **R2:** Lincoln 3–1 Royal Bears; White Rose 3–2 Nottthemainteam; Essex 0–3 BU; Keele 2nd 0–3 Megalodon; UCL 2–3 City; No WiFi 3–2 My Poor Decals; Fake Warwick 3–0 Sussy; Portsmouth Pending 3–1 Swansea.
- **R3:** Byes for Lincoln, White Rose, BU and Megalodon (all promoted, 10 pts each). Keele 2nd 0–3 Fake Warwick; Essex 3–1 No WiFi; Nottthemainteam 3–1 Portsmouth Pending; Royal Bears 3–1 City; Swansea 3–1 UCL; Sussy 3–2 My Poor Decals.
- **Expected points:** Royal Bears 6, Fake Warwick 6, Essex 6, Nottthemainteam 6, City 4, Keele 2nd 4, No WiFi 4, Portsmouth Pending 4, Swansea 2, Sussy 2, UCL 0 (demoted), My Poor Decals 0 (demoted).

**Week 4 (24 Feb)**

- **R1:** UoBraindead 0–1 Chargers Green; RLExe 3–0 The Cabin; Trent Thunders 1–3 Sussy; Nottingham 3–0 Swansea; Royal Bears 3–2 Keele 2nd; Nottthemainteam 3–1 No WiFi; Essex 2–3 Portsmouth Pending; Fake Warwick 2–3 City.
- **R2:** Chargers 3–2 City; RLExe 3–2 Portsmouth Pending; Sussy 0–3 Nottthemainteam; Nottingham 3–1 Royal Bears; Fake Warwick 1–0 UoBraindead; Essex 3–0 The Cabin; No WiFi 0–3 Trent; Keele 2nd 0–3 Swansea.
- **R3:** Chargers 1–3 Nottingham; RLExe 3–0 Nottthemainteam; Royal Bears 0–1 Trent; Sussy 0–3 Essex; Portsmouth Pending 3–0 Swansea; City 1–0 Fake Warwick; Keele 2nd 1–0 UoBraindead; No WiFi 3–2 The Cabin.
- **Expected points:** Nottingham 10 and RLExe 10 (promoted); **Chargers 7 and Nottthemainteam 7** (lost the promotion match); City 6; Royal Bears 4.

These make excellent **unit tests** for the points engine.

---

## 6. Data model (proposed Postgres / Supabase schema)

Treat this as a starting point. Explain it to Ali and adjust with him before migrating.

```sql
-- Seasons and competitions
create table seasons (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,           -- 'spring-26'
  name text not null                   -- 'NSE Spring 26'
);

create type tier as enum ('div1', 'div2', 'swiss');

create table rulesets (                -- points ladder per tier/season (data-driven, see 3.3)
  id uuid primary key default gen_random_uuid(),
  season_id uuid references seasons(id),
  tier tier not null,
  ladder jsonb not null                -- e.g. {"2-0:W":10,"2-0:L":7,"1-1:W":6,"1-1:L":4,"0-2:W":2,"0-2:L":0}
);

-- Teams (ours and opponents)
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,                  -- 'Royal Bears Rocket league'
  short_name text,                     -- 'Royal Bears'
  nse_slug text unique,                -- 'royal-bears--rocket-league-'
  is_ours boolean not null default false
);

create table players (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  nse_profile_url text,
  platform_ids jsonb                   -- steam/epic ids to match ballchasing players
);

create table roster_entries (          -- player <-> team per season
  team_id uuid references teams(id),
  season_id uuid references seasons(id),
  player_id uuid references players(id),
  role text,                           -- 'leader' | 'player' | 'sub'
  primary key (team_id, season_id, player_id)
);

-- A league night for one tier
create table nights (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references seasons(id),
  tier tier not null,
  week int not null,                   -- 3..6
  date date not null
);

-- One best-of-N series
create type stage as enum ('league', 'playoff');
create type series_result as enum ('win', 'loss', 'bye');

create table series (
  id uuid primary key default gen_random_uuid(),
  nse_match_id int unique,
  stage stage not null,
  night_id uuid references nights(id),       -- league only
  round int,                                  -- 1..3 league
  playoff_round text,                         -- 'last32' | 'last16' | 'qf' | 'sf' | 'final'
  our_team_id uuid references teams(id),
  opponent_id uuid references teams(id),      -- null = bye
  our_score int, opp_score int,
  best_of int not null default 5,
  is_forfeit boolean not null default false,
  result series_result not null,
  played_at timestamptz
);

-- Individual games inside a series (filled from replays)
create table games (
  id uuid primary key default gen_random_uuid(),
  series_id uuid references series(id) on delete cascade,
  game_number int not null,
  ballchasing_id text unique,
  our_goals int, opp_goals int,
  overtime boolean,
  raw jsonb,                                   -- full ballchasing response
  processed_at timestamptz
);

create table player_game_stats (
  game_id uuid references games(id) on delete cascade,
  player_id uuid references players(id),       -- null for opponents not in players table
  team_side text,                              -- 'ours' | 'opp'
  display_name text,
  score int, goals int, assists int, saves int, shots int, mvp boolean,
  extra jsonb,                                 -- boost/positioning etc. for later
  primary key (game_id, display_name)
);

-- Weekly points for OTHER teams (we only have their totals, not their rounds)
create type night_status as enum ('played', 'promoted_in', 'promoted_out', 'relegated_out', 'absent');
create table external_night_results (
  night_id uuid references nights(id),
  team_id uuid references teams(id),
  points int,
  status night_status not null default 'played',
  primary key (night_id, team_id)
);

-- Admin notes (captain's notes, private)
create table scouting_notes (
  id uuid primary key default gen_random_uuid(),
  opponent_id uuid references teams(id),
  body text not null,
  created_at timestamptz default now()
);
```

**Design tension to discuss with Ali:** our points are **computed** from `series`, but standings also need **other teams'** points, which we only have as numbers from the sheet (`external_night_results`). Recommendation: compute ours, import theirs, and add a check that flags when our computed points differ from the sheet's value for City.

**RLS:**
- `select` is public on everything **except** `scouting_notes`.
- `insert`, `update` and `delete` only when `auth.uid()` is in an `admins` table (one row: Ali).
- `scouting_notes` is admin-only for all operations.

---

## 7. Core logic

### 7.1 Points engine

```ts
type R = 'W' | 'L' | 'BYE';
function nightPoints(r1: R, r2: R, r3: R, ladder: Record<string, number>) {
  const bracket = r1 === 'W' && r2 === 'W' ? '2-0'
                : r1 === 'L' && r2 === 'L' ? '0-2' : '1-1';
  const r3res = r3 === 'L' ? 'L' : 'W';         // BYE counts as winning R3 (Week 3 exception)
  return {
    points: ladder[`${bracket}:${r3res}`],
    bracket,
    path: describe(bracket, r3res),             // "1–1, won decider"
    promoted: bracket === '2-0' && r3res === 'W',
    relegated: bracket === '0-2' && r3res === 'L',
  };
}
```

- Forfeit wins count as `W`.
- Write the Section 5.5 fixtures as tests first. Also test all Champions nights (expect 4, 6, 4, 6) and Chargers in Week 4 (7).
- Round 3 labels come from the bracket: 2–0 is the "Promotion match", 1–1 the "Decider", 0–2 the "Relegation match". Round 2 labels: "Winners' match" or "Losers' match".

### 7.2 Scenarios engine (dashboard "Scenarios" section)

**Inputs:**
1. Current standings totals (computed and imported).
2. Next night's **Round 1 opponent**, from the NSE draw. Entered by admin, or "TBC" if unknown.
3. The tier's **ladder**.

**Outputs:**
- **Six outcome rows:** each path gives points, a new total, and an effect (promoted, stay, or relegated).
- **Headline:** "Win all three rounds, starting with {R1 opponent}, and you are promoted to Division 1."
- **Rivals within reach:** teams within a threshold of us. Show the gap and a plain-English condition, like "Outscore them by 3+ to pass them" or "They pass you only if they outscore you by 3+". Compute feasibility against the discrete set of possible points: a gap only matters if the ladder can produce that difference.
- **Playoff lines:** top 4 get Bye R1+R2, 5th–8th get Bye R1. Note tiebreaks as TBC.

**Copy rule (Ali explicitly flagged this):** never write "win the 1–0 match" or "the 2–0 match". Those read like scorelines. Use "Winners' match", "Losers' match", "Round 3", "Win all three", "Split R1 + R2, win R3", and so on.

### 7.3 Derived stats

- Series record (forfeits included, footnoted).
- Game record (forfeits excluded).
- Game 5s (series decided 3–2 either way).
- Average points per night (with best and worst).
- Form: last 5 series, newest first, playoffs included.
- Head-to-head per opponent: series W–L, games W–L, meetings list with each meeting's points effect. For example, "Cost you 2 pts (6 → 4)" is the difference between winning and losing that Round 3.
- Scouting "patterns": generated sentences, e.g. how many nights you met them, how many meetings were deciders, which bracket they usually land in.

---

## 8. ballchasing.com integration

- **Auth:** header `Authorization: <token>`. Get a token at ballchasing.com → Upload tab. Store it as the Vercel env var `BALLCHASING_TOKEN`. **Server only.**
- **Ping:** `GET https://ballchasing.com/api/`
- **Upload:** `POST https://ballchasing.com/api/v2/upload?visibility=public|unlisted|private`, `multipart/form-data`, with a single part named **`file`**. Returns **201** with the new replay `id`, or **409** for a duplicate (the response includes the existing `id`, so treat 409 as success).
- **Fetch stats:** `GET https://ballchasing.com/api/replays/{id}`. Processing is asynchronous, so **poll** until the status is ready (the status field is `pending`, `ok` or `failed`). **Verify the exact field names against the docs** before mapping. Map core stats per player (score, goals, assists, saves, shots, MVP) into `player_game_stats`, and store the full JSON in `games.raw`.
- **Rate limits:** a **429** means back off and retry. Limits vary by patron tier. Queue uploads and keep calls sequential.
- **Optional:** create a ballchasing **group** per series to mirror our structure.
- **Caveat:** replay files are only available on **PC**. Console players cannot export `.replay` files. Replays must come from a PC player on each team (BakkesMod auto-upload is an option). Tell Ali about this if it's relevant.
- **Matching players:** map ballchasing player names or platform IDs to `players` via `platform_ids`. Unmatched names go to an admin "link player" step.

---

## 9. Design system (approved)

The full source for every approved screen is in `design-reference/`. See Section 11 for how to read those files. Match them closely.

### 9.1 Colour tokens

| Token | Hex | Use |
|---|---|---|
| `bg-page` | `#07090D` | Page behind app |
| `bg-app` | `#0B0E14` | App background |
| `bg-header` | `#080A0F` | Top bar and nav |
| `panel` | `#121722` | Cards and panels |
| `inset` | `#0D1118` | Cards inside panels |
| `border` | `#1F2633` | Panel borders |
| `divider` | `#1A202B` | Row separators |
| `border-strong` | `#2A3342` | Inputs, outline buttons, dashed placeholders |
| `text` | `#E8ECF2` | Primary text |
| `text-2` | `#C4CCD8` | Secondary text |
| `text-3` | `#A7B0BF` | Supporting copy |
| `muted` | `#8B95A7` | Labels, captions |
| `disabled` | `#5A6475` | Placeholders ("—") |
| `accent` | `#F5B83D` | Gold brand highlight (hover `#FFD27A`); text on accent is `#0B0E14` |
| `win` | `#4DA3FF` | Wins (blue) |
| `loss` | `#FF7A45` | Losses (orange) |
| `highlight-bg` | `#1A1F12` | Our row, selected item |
| `highlight-border` | `#5C4A1C` | Callouts, "You ×2" ladder rows |

Always show the **W or L letter** alongside the colour, so the result doesn't rely on colour alone. The accent is a design lever: swap it if City Esports has official colours (**OPEN**).

### 9.2 Typography (use `next/font/google`)

- **Display:** Chakra Petch 500, 600, 700. Used for headings, stat numbers and buttons. Mostly uppercase, letter-spacing 0.06–0.1em.
- **Body:** IBM Plex Sans 400, 500, 600.
- **Numbers and scores:** IBM Plex Mono 500, 600.
- **Scale:** desktop hero h1 84px (mobile 44), page h1 48–64, section h2 22px uppercase, big stats 40–72, labels 11–12px uppercase with letter-spacing 0.12–0.16em.

### 9.3 Shapes and patterns

- **No rounded corners.** The broadcast feel comes from angles, via `clip-path`:
  - Buttons and tags (parallelogram): `polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)`
  - Accent stat block (cut corner): `polygon(0 0, 100% 0, 100% 100%, 18px 100%, 0 calc(100% - 18px))`
  - Logo mark: `polygon(25% 0, 100% 0, 75% 100%, 0 100%)`
  - Bar-chart bars: `polygon(0 10px, 10px 0, 100% 0, 100% 100%, 0 100%)`
- **Result cards:** a 3px top border in the win or loss colour.
- **Selected or our row:** a 4px left border in the accent colour, on `highlight-bg`.
- **Active nav:** a 3px bottom border in the accent colour.
- **Placeholders for missing replay data:** dashed `border-strong` box, "—" in `disabled`, and a caption like "Awaiting replay". **Never invent numbers.**
- **Touch targets ≥ 44px.** Use real `<button>` and `<a>` elements, and add `aria-label` to icon-only buttons.
- **Layout:** desktop content width 1440 with 48px side padding; main grids `1.7fr / 1fr`. Phone (390) uses 16px padding and single-column stacks.

---

## 10. Pages and routes

Suggested routes (App Router):

```
/                                   → redirect to current season + champions
/[season]/[team]                    Dashboard          (team = champions | commanders)
/[season]/[team]/scouting           Opponent list (+ default selected)
/[season]/[team]/scouting/[opp]     Head-to-head
/[season]/[team]/matches            Latest night
/[season]/[team]/matches/[week]     Night detail (?series=<id> selects a series)
/[season]/[team]/players            Leaderboard + selected profile
/[season]/[team]/players/[player]
/admin                              Protected: nights, series entry, replay upload, imports, roster, notes
```

**Global chrome, on every page:**
- Header: logo mark, "CITY ESPORTS / ROCKET LEAGUE TRACKER"; nav (Dashboard, Scouting, Matches, Players); season selector at top right ("NSE Spring 26 ▾").
- Team switcher at the top of the content ("City Champions · Div 2" | "City Commanders · Swiss"). **Switching keeps you on the same page.**
- Phone: compact header with a menu button, and a tab row (Dashboard, Scouting, Matches, Players).

### 10.1 Dashboard (in this order)

1. **Hero:** team switcher, team name (huge, uppercase), one-line summary ("Division 2 · Finished 6th of 16 · Playoffs: …"), a Final rank box and a Season points box (accent).
2. **Four stat tiles:** Series record, Game record, Game 5s, Avg per night (each with a small note).
3. **Two columns.**
   - **Left:**
     - **League nights:** a W/L legend, then one row per week. Each row has the week and date, three round cards (round label, opponent, "W 3–2" in the result colour), and "+pts" with the path text.
     - **Points per night:** bar chart on a 0–10 scale.
   - **Right:**
     - **Form:** 5 blocks, newest first.
     - **How nights score:** the ladder, with the rows this team hit highlighted ("You ×2").
     - **Roster:** stats unlock with replays.
4. **Scenarios** (Ali asked for this **just above the standings**):
   - Header tag "WEEK N PREVIEW" and a "Going in: …" line.
   - Headline callout.
   - Three cards: Go 2–0, Go 1–1, Go 0–2. Each card has two outcomes, "Win Round 3" and "Lose Round 3", showing +pts, the total, and the effect in the effect colour.
   - Right-hand column: **Rivals within reach**.
   - Footnote on playoff lines and tiebreaks.
   - Between seasons or with no upcoming night: hide the section, or show the last preview labelled clearly.
5. **Standings:** columns POS, TEAM, WK3–WK6, TOTAL, PLAYOFFS. Our row is highlighted; "—" means not in the division that week.
   - For Commanders, this becomes **Swiss standings**, and the scenarios use the Swiss ladder (**OPEN**).

### 10.2 Scouting

- **Sidebar:** a labelled search input, and the opponents list sorted by meetings (name, meeting count, and the W–L record in the result colour). The selected opponent is highlighted.
- **Head-to-head hero:** a "HEAD TO HEAD" tag, the opponent name, their division, finish and points, and a big series score "CITY 1 – 2 BEARS" with games underneath.
- **"Past games against {Team}"** (Ali renamed this from "Meetings"): cards showing week and date, round label, score, WIN/LOSS, and the points effect. Each card links to the match night.
- **Their season:** weekly points tiles with their path notes.
- **Patterns:** generated insight bullets, plus a replay-insights placeholder ("0 / N games").
- **Captain's notes:** a collapsed bar ("Add note ▾"), admin-only.

### 10.3 Matches (night detail)

- Week tabs (WK 3 … WK 6, PLAYOFFS) and the team switcher.
- Title "Week 6" with the date and venue line.
- **Night path:** three round cards joined by chevrons, showing the round label, opponent, score, WIN/LOSS and "Record after: 1–0". The focused series is slightly raised. Ends with an accent "NIGHT RESULT +6" block.
- **Selected series panel:**
  - Heading "ROUND 3 · 1–1 DECIDER · BEST OF 5" and "City Champions 3 – 2 Royal Bears".
  - A "Head to head" link and an **Upload replays** button (admin only).
  - Five game slots.
  - Two scoreboards (ours and theirs), with columns SCORE, G, A, SV, SH.

### 10.4 Players

- Team switcher, and a banner reading "Stats fill in from uploaded replays · 0 / 55 games".
- The "PLAYERS" title with "5 on the NSE roster · Spring 26".
- **Four leader cards:** Top scorer, Most saves, Playmaker, Highest avg score.
- **Leaderboard:** a Per game / Totals toggle, and columns GP, SCORE, G, A, SV, SH%, MVP. Rows are clickable, and a player needs at least 3 games to rank.
- **Profile panel:** avatar initial, name and role; six stat tiles; an avg-score-by-night chart; and a best game.

### 10.5 Phone

- Same content, stacked.
- The dashboard has a 2×2 tile grid, form, league-night cards (the three rounds as rows), a compact Scenarios block (six plain-language rows such as "Win all three", "Win R1 + R2, lose R3" … "Lose all three"), and the top 8 of the standings with a "Full standings" link.
- **Ali approved the phone design as-is.**

### 10.6 Admin

These screens aren't designed yet, so keep them simple and in the same system.
- **Night entry:** pick tier and week, then enter R1–R3 (opponent, score, forfeit flag). Show a live points preview from the engine.
- **Replay upload:** drag-and-drop multiple `.replay` files onto a series, with per-file status (queued, uploading, processing, done, duplicate, failed).
- **Import:** paste or pull the Google Sheet CSV into `external_night_results`, with a diff preview.
- **Roster management**, and **linking ballchasing names to players**.
- **Upcoming night:** set the next Round 1 opponent (this feeds Scenarios).

---

## 11. How to read `design-reference/*.dc.html`

These are the approved mockups from a design canvas. Their format is **not React**, so translate them:

- `<x-dc>` wraps the markup, and `<helmet>` holds the font `<link>` and base CSS.
- `{{name}}` is a value from `renderVals()` in the `<script type="text/x-dc">` block at the bottom.
- `<sc-for list="{{items}}" as="item">` is a `.map()`, and `<sc-if>` is a conditional.
- Inline `style="…"` values are exact. Lift the spacing, sizes and colours straight into Tailwind or CSS variables.
- `renderVals()` contains the **real Spring 26 data** used in the mock. It's useful as seed or fixtures.
- **Files:** `Main.dc.html` (dashboard, desktop), `Mobile.dc.html` (dashboard, phone), `Scouting.dc.html`, `Series.dc.html` (match night), `Players.dc.html`.
- **Live canvas (Ali's account):** https://claude.ai/artifact/3ye6AsXrZqEZjtVakNgaZy

---

## 12. Environment and setup

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server only (imports, replay processing)
BALLCHASING_TOKEN=                # server only
ADMIN_EMAIL=                      # Ali's login
```

Suggested stack details (confirm with Ali): Tailwind for styling (map Section 9 tokens to CSS variables), `@supabase/ssr` for auth in the App Router, Zod for input validation, and Vitest for the points and scenario engines.

---

## 13. Open questions (ask Ali; do not assume)

1. **Commanders:** the Swiss tournament URL, their match history and roster.
2. **Division 1 and Swiss points ladders:** derive from NSE pages, then confirm.
3. **Tiebreak rules** for standings.
4. **Playoff series lengths** per round (the Last 16 was at least best-of-7).
5. **Week 3 bye exception:** confirm the modelling approach.
6. **Branding:** City Esports official colours and logo file (the gold accent is a placeholder).
7. **Players:** which nickname is Ali's, and whether player pages should be public.
8. **Replays:** who on each team is on PC and can supply `.replay` files.
9. **Future seasons:** how the site should switch seasons (the season selector already exists in the UI).
10. **Scraping NSE:** whether to automate imports or keep them manual. NSE pages are HTML (partly JS-rendered), and the Google Sheet CSV export is the easiest automated source.

---

## 14. Build plan (checklist)

**Phase 0: Setup**
- [ ] Create the Next.js app (TS, App Router, Tailwind, ESLint) and push to GitHub
- [ ] Create the Supabase project and link Vercel; add env vars
- [ ] Set up fonts (Chakra Petch, IBM Plex Sans, IBM Plex Mono) and design tokens as CSS variables

**Phase 1: Data**
- [ ] Walk Ali through the schema (Section 6); agree changes
- [ ] Write migrations and RLS policies (public read, admin write, notes private)
- [ ] Seed script: season, teams, the Champions roster and all series (Section 5.2), and the Div 2 external results (Section 5.3 / `seed-data/`)

**Phase 2: Engines (test first)**
- [ ] `nightPoints()` with tests from Section 5.5 and the Champions weeks
- [ ] Derived stats (records, game 5s, form, head-to-head)
- [ ] Scenarios engine with tests using the pre-Week 6 table (Section 5.3)

**Phase 3: UI, in priority order**
- [ ] Global chrome: header, nav, season selector, team switcher (keeps the current page), phone tab row
- [ ] Dashboard (Section 10.1), desktop and phone
- [ ] Scouting (Section 10.2)
- [ ] Matches (Section 10.3)
- [ ] Players (Section 10.4) with placeholders

**Phase 4: Admin and replays**
- [ ] Supabase Auth login, and an `admins` gate
- [ ] Night entry form with a live points preview
- [ ] Sheet CSV import with a diff preview
- [ ] ballchasing upload, polling, stat mapping and player linking

**Phase 5: Ship**
- [ ] Responsive QA at 390 / 768 / 1440; accessibility pass (contrast, focus, labels)
- [ ] Deploy to Vercel production
- [ ] README plus `docs/points-engine.md` and `docs/data-model.md`

---

## 15. Contents of this bundle

```
HANDOFF.md                 ← this file
design-reference/          ← approved mockup sources (Section 11)
  Main.dc.html  Mobile.dc.html  Scouting.dc.html  Series.dc.html  Players.dc.html
seed-data/                 ← raw CSV exports of the NSE standings sheet (29 Sep 2026)
  division-1.csv  division-2.csv  swiss.csv
```
