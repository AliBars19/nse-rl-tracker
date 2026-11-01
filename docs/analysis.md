# Replay analysis (how it is done, and what it found)

Ali asks Claude for match write-ups after each night. Two routes, depending on what is available. Nothing here is stored in the database; it is
done offline and the findings live in this file.

## Route 1: raw `.replay` files (deep, goal-by-goal)

Needs the files themselves: ballchasing only lets signed-in users download replays, and Claude sessions have no ballchasing login, so Ali has to
send a zip into the chat (the replays are the ones he also uploads on the Replays page). Put each zip in its own empty directory.

```bash
python3 -m venv venv && ./venv/bin/pip install subtr-actor-py        # boxcars-py is too old for current replays
./venv/bin/python -I scripts/analysis/extract.py <replay dir> out.json   # one JSON of goals, touches, demos, team and player metrics
./venv/bin/python -I scripts/analysis/prep_frames.py <replay dir> c      # pickles c0_*.pkl, c1_*.pkl … in match order
./venv/bin/python -I scripts/analysis/report.py c "R4G1" "R4G2" …        # kickoffs and shot distances per game
./venv/bin/python -I scripts/analysis/walk.py c <replay index> <goal no> …  # second-by-second positions + boost before a goal
```

- Set `CITY_IS_TEAM_ZERO` at the top of `walk.py` and `report.py` (City were blue in both Champions nights, orange in the Commanders' Week 1).
- Boost from subtr-actor is on a 0–255 scale (divide by 2.55 for %). Goal y is ±5120; in a game where City are blue they defend −y.
- Kickoff "possession" and "possession %" are subtr-actor labels and differ from ballchasing's possession figure; quote them as guidance.
- The clock freezes during goal replays, so a kickoff's elapsed time equals the goal that preceded it. A goal at clock 0:00 can still be in regulation
  if the ball was in the air (R3 G4 of the Commanders' Week 1 was won that way).

## Route 2: ballchasing's public replay pages (no files needed)

`https://ballchasing.com/replay/<id>` is public for unlisted/public uploads and contains the team and player stat tables (shots, saves, boost,
big pads, positioning, speed, demos). The replay ids are on the site's Matches page (the "Watch in 3D" links, in game order). It does **not**
contain the game timeline (needs sign-in) or anything per goal, so no overtime split, no goal buildup, no kickoffs.

```bash
curl -s https://ballchasing.com/replay/<id> -o bc/r1g1.html          # one file per game
./venv/bin/python -I scripts/analysis/bcparse.py bc/*.html > bc/all.json
./venv/bin/python -I scripts/analysis/bcsummary.py bc/all.json yam.een,stav1c,kidwys r1g1:R1G1_W2-1 r1g2:R1G2_L1-2 …
```

`bcsummary.py` assumes City is the first (blue) column. Check the order of replay ids against each game's score before trusting the labels
(`sort -u` on the links loses the order).

## Findings so far

**Champions vs Durham Defenders (Stage 1, round 3, L 0–3).** City scored 2 from 22 shots, Durham 8 from 23. City won 1 of 10 kickoff restarts (opening kickoff 3/3);
4 of Durham's 8 goals were counter-attacks and 4 had City's last man at ≤21% boost. Durham out-collected boost every game; City's possession in G3 was 22%.
Recommendations: a restart routine, keep the last man's boost up, never send all three forward or all three back, deny big pads, closer shots, share the attack.

**Commanders, Week 1 (R2 L 0–3 vs No Execuses, R3 W 3–1 vs Leic is More; no replays for R1 vs UWE Sea Stags).**
City out-boosted every opponent in all 7 games (about 7,740 vs 6,060 per game) and had 53 shots to 48. R2: 1 goal from 22 shots (4.5%) vs 5 from 25.
R3: demos 7 vs 2 per game; lost G1 2–3 from 2–0 up. Kickoff possession went City's way 6 of 27 times (5 of 20 restarts, 4 of those in one game).
At least one City defender was ≤25% boost on 9 of the 11 goals conceded; 6 of 11 had the last man ≤27%. Conceded goals: 6 sustained pressure, 3 counter-attacks, 2 other.
City's own goals: 4 of 10 were counter-attacks. Opponent defenders were ≤27% boost on all 10 City goals.

**Champions, Week 2 (27 Oct): R4 W 3–0 vs Swansea Slotters, R5 L 1–3 vs Southampton Saver Menu, R6 bye. Final 4–2, so Division 1.** Stats-level only (Route 2).
R4: out-boosted and out-paced Swansea (128s vs 212s at 0 boost per game, 67 vs 52 big pads, 4.3 goals a game vs 2.0).
R5: all four games went to overtime (W 2–1, L 3–4, L 2–3, L 2–3). Even on time in own third (592s vs 597s) and shots (43–39). Southampton's
**Player 17** scored 8 of their 11 goals from 13 shots. City converted 21% to their 28%. In the three losses Southampton collected more boost and more big pads.
Not answerable without the raw files: shots/saves in overtime only, how each overtime goal happened.

## Standings sheet ("Week N Rocket Standings")

https://docs.google.com/spreadsheets/d/1TQ7WzJ4a8Ku4Jl3hmpx9Kq5WERE3aV1euabSNfyo3To is the season's permanent sheet; the newest tab is the
current one ("After week 2" now). It lists only group membership, no scores. After week 2: Group 1 qualified for Division 1 (City Champions are in it),
Group 2 for Division 2, Groups 3–6 are Swiss starting on 10 / 8 / 6 / 4 points (City Commanders: Group 3, 10 points). The "After week 1" tab confirms
the Stage 1 rule in its own headings ("need N more wins for div 1"; 4 wins from 6 rounds).
