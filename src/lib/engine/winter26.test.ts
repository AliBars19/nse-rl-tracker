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

function winterDataset(): Dataset {
  const files: Array<{ file: string; tier: Tier; stage: "placement" | "league"; week: number }> = [
    { file: "rocket-league-nse-winter-26--stage-1", tier: "swiss", stage: "placement", week: 1 },
    { file: "rocket-league-nse-winter-26---division-1--week-3", tier: "div1", stage: "league", week: 3 },
    { file: "rocket-league-nse-winter-26---division-2--week-3", tier: "div2", stage: "league", week: 3 },
    { file: "rocket-league-nse-winter-26--week-3", tier: "swiss", stage: "league", week: 3 },
  ];
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
    const night: Night = { id: `${f.tier}-${f.week}`, seasonId: "s", tier: f.tier, stage: f.stage, week: f.week, label: f.stage === "placement" ? "Stage 1" : `Week ${f.week}`, date: "2026-11-03", venue: null };
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

const ds = winterDataset();
const ctx = ctxOf(ds);
const champions = ourTeam(ds, "champions")!;
const commanders = ourTeam(ds, "commanders")!;

describe("Winter 26 rulesets", () => {
  it("has NSE's Division 1 ladder, the same numbers for Division 2, and no single ladder for the Swiss", () => {
    const ladder = { "2-0:W": 10, "2-0:L": 7, "1-1:W": 6, "1-1:L": 4, "0-2:W": 3, "0-2:L": 0 };
    expect(getRuleset("winter-26", "div1")).toMatchObject({ status: "verified", relegatesTo: "div2", promotesTo: null });
    expect(getRuleset("winter-26", "div1").ladder).toEqual(ladder);
    expect(getRuleset("winter-26", "div2").ladder).toEqual(ladder); // not Spring's 0–2 win = 2
    expect(getRuleset("winter-26", "swiss")).toMatchObject({ status: "unknown", ladder: null });
  });

  it("agrees with the points NSE published for every team with a number, in both divisions", () => {
    let checked = 0;
    for (const night of ds.nights.filter((n) => n.stage === "league" && n.tier !== "swiss")) {
      for (const team of ds.teams) {
        const tn = teamNight(ctx, night, team.id);
        if (!tn?.computed || tn.sheet?.points == null) continue;
        expect([night.tier, team.name, tn.computed.points]).toEqual([night.tier, team.name, tn.sheet.points]);
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
    expect(wk3.pointsSource).toBe("engine");
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
