import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Dataset, Night, Series, Team, Tier } from "@/lib/domain/types";
import { rowToSeries } from "@/lib/import/nse-series";
import type { NseMatchRow, NsePointsSection, NseTeamRef } from "@/lib/import/nse";
import { pointsCells } from "@/lib/import/nse-points";
import { nightPageTargets, tierAfterImport } from "@/lib/import/tournaments";
import { ctxOf, ourTeam, seasonSeries } from "./context";
import { nightsForSeason, teamNight } from "./nights";
import { nightPoints } from "./points";
import { getRuleset } from "./rulesets";
import { standingsTable } from "./standings";

/**
 * Winter 26 as NSE published it: Stage 1 night 1 (Swiss tournament) and league Week 3 in all three
 * tournaments (snapshots in seed-data/nse). City Champions qualified for Division 1; City Commanders
 * are in the Swiss.
 */
function snapshot(file: string): { rows: NseMatchRow[]; pointsSections?: NsePointsSection[] } {
  return JSON.parse(readFileSync(join(process.cwd(), "seed-data", "nse", `${file}.json`), "utf8"));
}
const load = (file: string): NseMatchRow[] => snapshot(file).rows;

const WEEK_DATES: Record<number, string> = { 3: "2026-11-03", 4: "2026-11-10", 5: "2026-11-17" };

/** The season as imported up to `lastWeek` (3 to 5). Division 2 has no Week 4/5 snapshot (City are not in it). */
function winterDataset(lastWeek: number): Dataset {
  const files: Array<{ file: string; tier: Tier; stage: "placement" | "league"; week: number }> = [
    { file: "rocket-league-nse-winter-26--stage-1", tier: "swiss", stage: "placement", week: 1 },
    { file: "rocket-league-nse-winter-26---division-1--week-3", tier: "div1", stage: "league", week: 3 },
    { file: "rocket-league-nse-winter-26---division-2--week-3", tier: "div2", stage: "league", week: 3 },
    { file: "rocket-league-nse-winter-26--week-3", tier: "swiss", stage: "league", week: 3 },
  ];
  for (const week of [4, 5].filter((w) => w <= lastWeek)) {
    files.push({ file: `rocket-league-nse-winter-26---division-1--week-${week}`, tier: "div1", stage: "league", week });
    files.push({ file: `rocket-league-nse-winter-26--week-${week}`, tier: "swiss", stage: "league", week });
  }
  const teams = new Map<string, Team>();
  const team = (ref: NseTeamRef): string => {
    const key = ref.slug ?? `name:${ref.name}`;
    if (!teams.has(key)) {
      teams.set(key, {
        id: key,
        slug: key,
        name: ref.name,
        shortName: ref.name,
        nseSlug: ref.slug,
        ourKey: ref.slug === "city-champions" ? "champions" : ref.slug === "city-commanders" ? "commanders" : null,
      });
    }
    return key;
  };
  const nights: Night[] = [];
  const series: Series[] = [];
  const externalResults: Dataset["externalResults"] = [];
  for (const f of files) {
    const rows = load(f.file);
    const night: Night = { id: `${f.tier}-${f.week}`, seasonId: "s", tier: f.tier, stage: f.stage, week: f.week, label: f.stage === "placement" ? "Stage 1" : `Week ${f.week}`, date: f.stage === "placement" ? "2026-10-20" : WEEK_DATES[f.week], venue: null };
    nights.push(night);
    for (const cell of pointsCells(snapshot(f.file).pointsSections ?? [], night.id, (ref) => (ref.slug ? team(ref) : undefined))) {
      externalResults.push({ nightId: cell.night_id, teamId: cell.team_id, points: cell.points, status: cell.status });
    }
    for (const row of rows) {
      const r = rowToSeries(row, { seasonId: "s", tier: f.tier, night: { id: night.id, stage: f.stage }, teamId: team, seriesId: (id) => `m${id}` });
      if ("series" in r) series.push(r.series);
    }
  }
  const season = { id: "s", slug: "winter-26", name: "NSE Winter 26", shortName: "Winter 26", isCurrent: true, isFinished: false };
  const champions = [...teams.values()].find((t) => t.ourKey === "champions")!;
  const commanders = [...teams.values()].find((t) => t.ourKey === "commanders")!;
  return {
    season,
    seasons: [season],
    teams: [...teams.values()],
    teamSeasons: [
      { seasonId: "s", teamId: champions.id, tier: "div1", nseTournamentSlug: "rocket-league-nse-winter-26---division-1" },
      { seasonId: "s", teamId: commanders.id, tier: "swiss", nseTournamentSlug: "rocket-league-nse-winter-26" },
    ],
    nights,
    series,
    externalResults,
    externalStandings: [],
    players: [],
    roster: [],
    games: [],
    playerGameStats: [],
    upcoming: [],
  };
}

const ds = winterDataset(3);
const ctx = ctxOf(ds);
const champions = ourTeam(ds, "champions")!;
const commanders = ourTeam(ds, "commanders")!;

describe("Winter 26 rulesets", () => {
  const WEEK_3 = { "2-0:W": 10, "2-0:L": 7, "1-1:W": 6, "1-1:L": 4, "0-2:W": 3, "0-2:L": 0 } as const;

  it("has no single Division 1 ladder (two pods from Week 4), the Division 2 ladder, and none for the Swiss", () => {
    expect(getRuleset("winter-26", "div1")).toMatchObject({ status: "unknown", ladder: null, relegatesTo: "div2", promotesTo: null });
    expect(getRuleset("winter-26", "div2").ladder).toEqual(WEEK_3); // not Spring's 0–2 win = 2
    expect(getRuleset("winter-26", "swiss")).toMatchObject({ status: "unknown", ladder: null });
  });

  it("Week 3 Division 1 paid 10 / 7 / 6 / 4 / 3 by path, as NSE published it, for every team with a number; Division 2 agrees with the ladder", () => {
    let checked = 0;
    for (const night of ds.nights.filter((n) => n.stage === "league" && n.tier !== "swiss")) {
      for (const team of ds.teams) {
        const tn = teamNight(ctx, night, team.id);
        if (tn?.sheet?.points == null || tn.rounds.length < 3) continue;
        const [r1, r2, r3] = [1, 2, 3].map((n) => tn.rounds.find((r) => r.round === n)!.ts.result);
        const np = nightPoints(r1, r2, r3, WEEK_3);
        expect([night.tier, team.name, np.points]).toEqual([night.tier, team.name, tn.sheet.points]);
        checked++;
      }
    }
    // 28 of Division 1's 32 teams have a number (four were demoted) and 24 of Division 2's (four promoted, four demoted)
    expect(checked).toBe(52);
  });
});

describe("City Champions in Division 1, Week 3", () => {
  const nights = nightsForSeason(ctx, champions.team.id, "div1");

  it("keeps Stage 1 even though it was played in the Swiss tournament", () => {
    expect(nights.map((n) => n.night.label)).toEqual(["Stage 1", "Week 3"]);
    expect(seasonSeries(ctx, champions.team.id, "div1").some((s) => s.series.stage === "placement")).toBe(true);
  });

  it("went 0–2 then won the relegation match: 3 points, as NSE published", () => {
    const wk3 = nights[1];
    expect(wk3.rounds.map((r) => [r.label, r.ts.opponent?.name, r.ts.result, `${r.ts.our}–${r.ts.opp}`])).toEqual([
      ["Opener", "Manchester Pookie Pies", "L", "2–3"],
      ["Losers’ match", "Diff Diddlers", "L", "1–3"],
      ["Relegation match", "UWE Sea Stags RL", "W", "3–2"],
    ]);
    expect(wk3.points).toBe(3);
    expect(wk3.pointsSource).toBe("sheet"); // NSE's published number: Division 1 has no single ladder
    expect(wk3.sheet).toMatchObject({ points: 3, status: "played" });
    expect(wk3.mismatch).toBe(false);
  });

  it("is a Division 1 table of NSE's weekly points, with the four demoted teams listed as having left", () => {
    const table = standingsTable(ctx, "div1");
    expect(table).toMatchObject({ derived: true, source: "nse" });
    expect(table.weeks).toEqual([{ week: 3, label: "WK 3" }]);
    expect(table.rows).toHaveLength(28);
    expect(table.departed).toHaveLength(4);
    expect(table.departed.every((r) => r.cells[3].status === "relegated_out" && r.cells[3].points === null)).toBe(true);
    const ours = table.rows.find((r) => r.isOurs)!;
    expect(ours.total).toBe(3);
    // 4 teams on 10, 4 on 7, 8 on 6, 8 on 4, 4 on 3
    const count = (pts: number) => table.rows.filter((r) => r.total === pts).length;
    expect([10, 7, 6, 4, 3].map(count)).toEqual([4, 4, 8, 8, 4]);
    expect(table.rows.map((r) => r.position)).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
    expect(table.rows.map((r) => r.total)).toEqual([...table.rows.map((r) => r.total)].sort((a, b) => b - a));
    expect(ours.position).toBeGreaterThanOrEqual(25);
  });
});

describe("City Commanders in the Swiss, Week 3", () => {
  const nights = nightsForSeason(ctx, commanders.team.id, "swiss");

  it("took 10 Swiss points for going 2–0 and losing Round 3, from NSE's Points round", () => {
    expect(nights.map((n) => n.night.label)).toEqual(["Stage 1", "Week 3"]);
    const wk3 = nights[1];
    expect(wk3.rounds.map((r) => [r.ts.opponent?.name, r.ts.result])).toEqual([["Swansea Slotters", "W"], ["bingo lingo", "W"], ["Herts RL Team 1", "L"]]);
    expect(wk3.points).toBe(10);
    expect(wk3.pointsSource).toBe("sheet");
    expect(wk3.path).toBe("Won 2 of 3");
  });

  it("is a Swiss table with NSE's points, four promoted teams having left", () => {
    const table = standingsTable(ctx, "swiss");
    expect(table).toMatchObject({ derived: true, source: "nse" });
    expect(table.departed).toHaveLength(4);
    const ours = table.rows.find((r) => r.isOurs)!;
    expect(ours.total).toBe(10);
    expect(Math.max(...table.rows.map((r) => r.total))).toBe(10);
    expect(ours.position).toBeLessThanOrEqual(4); // only four teams scored 10
  });
});

describe("Weeks 4 and 5", () => {
  const ds5 = winterDataset(5);
  const ctx5 = ctxOf(ds5);
  const champs = ourTeam(ds5, "champions")!;
  const cmdrs = ourTeam(ds5, "commanders")!;

  it("Champions took 3 then 6 points in Division 1 (12 in all), as NSE published", () => {
    const nights = nightsForSeason(ctx5, champs.team.id, "div1");
    expect(nights.map((n) => n.night.label)).toEqual(["Stage 1", "Week 3", "Week 4", "Week 5"]);
    expect(nights.slice(1).map((n) => [n.points, n.pointsSource])).toEqual([[3, "sheet"], [3, "sheet"], [6, "sheet"]]);
    expect(nights[2].rounds.map((r) => [r.ts.opponent?.name, r.ts.result, `${r.ts.our}–${r.ts.opp}`])).toEqual([
      ["Couldnt care Leic", "L", "0–3"],
      ["Plymouth Leviathans", "W", "3–2"],
      ["Essex Blades (A)", "L", "0–3"],
    ]);
    expect(nights[3].rounds.map((r) => [r.ts.opponent?.name, r.ts.result])).toEqual([["QMUL Esports", "W"], ["Nottingham Archers", "W"], ["I'm Steel Standing", "L"]]);
  });

  it("Commanders took 8 then 10 Swiss points; a forfeit counts as the win it was", () => {
    const nights = nightsForSeason(ctx5, cmdrs.team.id, "swiss");
    expect(nights.map((n) => n.night.label)).toEqual(["Stage 1", "Week 3", "Week 4", "Week 5"]);
    expect(nights.slice(1).map((n) => n.points)).toEqual([10, 8, 10]);
    expect(nights[2].rounds.map((r) => [r.ts.opponent?.name, r.ts.result])).toEqual([["UCL Calavera", "W"], ["bingo lingo", "L"], ["Southampton Spitfires", "W"]]);
  });

  it("orders the Division 1 table by total, then the latest week's points, as NSE's sheet does", () => {
    const table = standingsTable(ctx5, "div1");
    expect(table.weeks.map((w) => w.week)).toEqual([3, 4, 5]);
    const ours = table.rows.find((r) => r.isOurs)!;
    expect(ours.total).toBe(12);
    expect(ours.cells[5]).toMatchObject({ points: 6 });
    for (let i = 1; i < table.rows.length; i++) {
      const [a, b] = [table.rows[i - 1], table.rows[i]];
      expect(a.total).toBeGreaterThanOrEqual(b.total);
      if (a.total === b.total) expect(a.cells[5]?.points ?? 0).toBeGreaterThanOrEqual(b.cells[5]?.points ?? 0);
    }
  });

  it("warns that Swiss totals lack Stage 1's starting points; Division 1 has no such note", () => {
    expect(standingsTable(ctx5, "swiss").note).toMatch(/Stage 1 starting points/);
    expect(standingsTable(ctx5, "div1").note).toBeUndefined();
  });
});

describe("where to look for a night", () => {
  it("covers the Swiss Stage 1 and every division's league weeks", () => {
    const t = nightPageTargets("winter-26");
    expect(t[0]).toMatchObject({ tier: "swiss", page: "stage-1", week: 1 });
    expect(t.filter((x) => x.page === "week-3").map((x) => x.tier).sort()).toEqual(["div1", "div2", "swiss"]);
    expect(t.some((x) => x.tournament === "rocket-league-nse-winter-26---division-1" && x.page === "week-6")).toBe(true);
  });

  it("falls back to the tournaments a City team is recorded in for an unlisted season", () => {
    const t = nightPageTargets("summer-27", [{ tier: "div2", tournament: "rocket-league-nse-summer-27-division-2" }]);
    expect(t.map((x) => [x.tier, x.page])).toEqual([["div2", "week-3"], ["div2", "week-4"], ["div2", "week-5"], ["div2", "week-6"]]);
  });

  it("only moves a City team to the tier it played in when that is its latest week", () => {
    expect(tierAfterImport(3, 0)).toBe(true);
    expect(tierAfterImport(4, 3)).toBe(true);
    expect(tierAfterImport(3, 3)).toBe(true);
    expect(tierAfterImport(3, 4)).toBe(false);
  });
});
