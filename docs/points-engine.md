# Points engine

Code: `src/lib/engine/points.ts` (scoring), `rulesets.ts` (ladders), `nights.ts` (applying it
to a team's night), `scenarios.ts` / `preview.ts` (what-ifs), `stats.ts`, `scouting.ts`.
Tests: `src/lib/engine/*.test.ts`.

## A league night

Each Tuesday is a three-round mini Swiss of best-of-5 series:

| Round | Who plays | Label on the site |
|---|---|---|
| 1 | everyone | Opener |
| 2 | R1 winners vs winners / losers vs losers | Winners' match / Losers' match |
| 3 | by record after R2: 2–0, 1–1, 0–2 | Promotion match / 1–1 decider / Relegation match |

The **ladder** maps (record after R2, R3 result) to points. `nightPoints(r1, r2, r3, ladder)`:

```ts
bracket = r1 & r2 both won ? "2-0" : both lost ? "0-2" : "1-1"
r3      = r3 === "L" ? "L" : "W"        // a Round 3 BYE counts as winning Round 3
points  = ladder[`${bracket}:${r3}`]
```

- **Forfeits** (a series recorded 1–0 in a best-of-5) count as wins for points and are flagged
  `is_forfeit`, so they are excluded from game-level stats.
- **Round 3 bye** (Week 3, and again Week 6, when an odd number of teams were 2–0): stored as a
  Round 3 series with no opponent and scored as the promotion outcome. (Handoff open question 5:
  implemented as the recommended "null opponent" option.)

## Ladders (Spring 26)

| Tier | Status | Ladder |
|---|---|---|
| **Division 2** | verified | 2–0 win R3 **10** (promoted) · 2–0 lose R3 **7** · 1–1 win **6** · 1–1 lose **4** · 0–2 win **2** · 0–2 lose **0** (relegated to Swiss) |
| Division 1 | derived, not modelled | Week 3: 10/7/6/4/3/0. From Week 4 Division 1 split into two groups: **upper** 15/12/11/9/8/6 and **lower** 8/6/5/3/2/0 |
| Swiss | unknown | Not a clean path ladder: 2 wins scored 8 or 7, 1 win 7 or 5, 0 wins 5 or 3; 3–0 teams play a promotion match (Round 4). |

Where a tier has no ladder the site uses the **NSE sheet's** points and hides Scenarios. For
Commanders that means every Swiss night shows the sheet value (8 each time, 40 total).

### How Division 2 was verified

`nights.test.ts` runs the engine for every Division 2 team, every week, and compares with the
sheet. Everything matches except three nights where a team lost Round 3 from 1–1 (ladder: 4)
but the sheet gives 6:

| Week | Team | Path | Engine | Sheet |
|---|---|---|---|---|
| 4 | Fake Warwick | L, W (forfeit), L (forfeit, to City) | 4 | 6 |
| 5 | Swansea Storm | L, W, L | 4 | 6 |
| 6 | Lincoln Swans | W, L, L | 4 | 6 |

Every other 1–1 Round 3 loser got 4, so these look like NSE adjustments. We don't bend the
engine to fit them. **Whose number wins:** for City teams the engine (the site can explain
it); for everyone else the sheet (the official record). The admin overview flags any City
night where the two disagree.

### Division 1 and Swiss: where the numbers came from

Derived by replaying every team's path from the NSE week pages against the sheet
(`seed-data/nse/*.json` + `seed-data/*.csv`). Division 1 fits two clean ladders once you
split by group; Swiss doesn't fit any path-only ladder, so it needs NSE's rules.

## Derived stats (`stats.ts`)

| Stat | Rule | Champions Spring 26 |
|---|---|---|
| Series record | wins–losses, **forfeits included** (footnoted), byes excluded | 6–7 (1 forfeit win) |
| Game record | sum of series scores, **forfeits excluded**, playoffs included | 25–30 |
| Game 5s | series that went the distance (3–2 in a Bo5, 4–3 in a Bo7) | 4–2 |
| Avg per night | points ÷ scoring nights, with best/worst | 5.0 (6 / 4) |
| Form | last 5 series, newest first, playoffs included, byes skipped | L W L W L |

A City team's season covers its league nights plus its playoff series. Swiss **Stage 1**
counts only for a team tracked in Swiss: Champions played Stage 1 before moving to Division 2,
and that isn't part of their Division 2 season.

## Scenarios (`scenarios.ts`, `preview.ts`)

Inputs: going-in totals for the table, the Round 1 opponent, the tier's ladder.

- **Six outcomes**: each path's points, new total and effect (promoted / stay / relegated).
- **Headline**: "Win all three rounds, starting with {R1 opponent}, and you are promoted to Division 1."
- **Rivals within reach**: teams within 6 points. For a gap *g* (theirs − ours):
  ahead → "Outscore them by *g*+1+ to pass them"; level → "Outscore them tonight to finish
  above"; behind → "They pass you only if they outscore you by |*g*|+1+". A gap the ladder
  can't produce in one night (max swing 10) says "Out of reach this week" / "Cannot pass you this week".
  The team holding the last top-4 or top-8 spot gets a prefix. Ties are treated as ties
  (tiebreaks unknown).
- **Which night:** an admin-entered upcoming night (live), otherwise the team's last
  league night rebuilt from final totals minus that week's points, labelled as archived.
  For Champions that reproduces the approved mockup exactly ("joint 5th · 14 pts", Trent
  Thunders, the same five rivals and notes).

**Copy rule:** never "win the 1–0 match" or "the 2–0 match" (they read like scorelines). A
test checks the generated copy for this.

## Scouting (`scouting.ts`)

- Opponents sorted by meetings, then by first meeting.
- Head-to-head: series W–L and games W–L (forfeits excluded from games).
- Each meeting's **points effect**: R1 "Sent you to the winners'/losers' match"; R2 "Put you
  in the promotion match" / "Dropped you into the 1–1 decider" / …; R3 "Cost you 2 pts (6 → 4)"
  / "Earned 6 pts instead of 4"; playoffs "Knocked you out in the Last 16".
- **Their season** uses the sheet's points with the engine's path notes, which needs every
  team's series, not just ours. That's why the data model stores series neutrally.
- **Patterns** are generated sentences: how often you met, which round types (with the points
  swing), where they usually land in Round 3, close series, forfeits.
