import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Dataset, Night, Series, Team, Tier } from "@/lib/domain/types";
import { rowToSeries } from "@/lib/import/nse-series";
import type { NseMatchRow, NseTeamRef } from "@/lib/import/nse";
import { nightPageTargets, tierAfterImport } from "@/lib/import/tournaments";
import { ctxOf, ourTeam, seasonSeries } from "./context";
import { nightsForSeason } from "./nights";
import { getRuleset } from "./rulesets";
import { standingsTable } from "./standings";

/**
 * Winter 26 as NSE published it: Stage 1 night 1 (Swiss tournament) and league Week 3 in all three
 * tournaments (snapshots in seed-data/nse). City Champions qualified for Division 1; City Commanders
 * are in the Swiss.
 */
function load(file: string): NseMatchRow[] {
  return JSON.parse(readFileSync(join(process.cwd(), "seed-data", "nse", `${file}.json`), "utf8")).rows;
}

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
  for (const f of files) {
    const rows = load(f.file);
    const night: Night = { id: `${f.tier}-${f.week}`, seasonId: "s", tier: f.tier, stage: f.stage, week: f.week, label: f.stage === "placement" ? "Stage 1" : `Week ${f.week}`, date: "2026-11-03", venue: null };
    nights.push(night);
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
    externalResults: [],
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
  it("has a derived ladder for both divisions and none for the Swiss", () => {
    expect(getRuleset("winter-26", "div1")).toMatchObject({ status: "derived", relegatesTo: "div2", promotesTo: null });
    expect(getRuleset("winter-26", "div1").ladder).toEqual({ "2-0:W": 10, "2-0:L": 7, "1-1:W": 6, "1-1:L": 4, "0-2:W": 3, "0-2:L": 0 });
    expect(getRuleset("winter-26", "div2").ladder?.["0-2:W"]).toBe(2);
    expect(getRuleset("winter-26", "swiss")).toMatchObject({ status: "unknown", ladder: null });
  });
});

describe("City Champions in Division 1, Week 3", () => {
  const nights = nightsForSeason(ctx, champions.team.id, "div1");

  it("keeps Stage 1 even though it was played in the Swiss tournament", () => {
    expect(nights.map((n) => n.night.label)).toEqual(["Stage 1", "Week 3"]);
    expect(seasonSeries(ctx, champions.team.id, "div1").some((s) => s.series.stage === "placement")).toBe(true);
  });

  it("went 0–2 then won the relegation match: 3 points", () => {
    const wk3 = nights[1];
    expect(wk3.rounds.map((r) => [r.label, r.ts.opponent?.name, r.ts.result, `${r.ts.our}–${r.ts.opp}`])).toEqual([
      ["Opener", "Manchester Pookie Pies", "L", "2–3"],
      ["Losers’ match", "Diff Diddlers", "L", "1–3"],
      ["Relegation match", "UWE Sea Stags RL", "W", "3–2"],
    ]);
    expect(wk3.points).toBe(3);
    expect(wk3.pointsSource).toBe("engine");
    expect(wk3.relegated).toBe(false);
  });

  it("is calculated into a Division 1 table of 32 teams, marked as not NSE's own", () => {
    const table = standingsTable(ctx, "div1");
    expect(table.derived).toBe(true);
    expect(table.rows).toHaveLength(32);
    expect(table.weeks).toEqual([{ week: 3, label: "WK 3" }]);
    const ours = table.rows.find((r) => r.isOurs)!;
    expect(ours.total).toBe(3);
    expect(ours.cells[3]).toMatchObject({ points: 3, status: "played" });
    // a full Division 1 night hands out these points: 4 teams on 10, 7, 6 ... never more than the ladder allows
    expect(Math.max(...table.rows.map((r) => r.total))).toBe(10);
    expect(table.rows.every((r) => [10, 7, 6, 4, 3, 0].includes(r.total))).toBe(true);
    // four teams lost a relegation match but NSE only moves two a week, so no one is marked as relegated here
    expect(table.rows.filter((r) => r.total === 0)).toHaveLength(4);
    expect(table.rows.every((r) => r.cells[3].status === "played")).toBe(true);
    // sorted best first, positions 1..32
    expect(table.rows.map((r) => r.position)).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
    expect(table.rows.map((r) => r.total)).toEqual([...table.rows.map((r) => r.total)].sort((a, b) => b - a));
  });
});

describe("City Commanders in the Swiss, Week 3", () => {
  const nights = nightsForSeason(ctx, commanders.team.id, "swiss");

  it("shows Stage 1 and Week 3 with no points (the Swiss ladder is unknown)", () => {
    expect(nights.map((n) => n.night.label)).toEqual(["Stage 1", "Week 3"]);
    const wk3 = nights[1];
    expect(wk3.rounds.map((r) => [r.ts.opponent?.name, r.ts.result])).toEqual([["Swansea Slotters", "W"], ["bingo lingo", "W"], ["Herts RL Team 1", "L"]]);
    expect(wk3.points).toBeNull();
    expect(wk3.path).toBe("Won 2 of 3");
  });

  it("has no calculated table rather than a made-up one", () => {
    const table = standingsTable(ctx, "swiss");
    expect(table.derived).toBe(true);
    expect(table.rows).toEqual([]);
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
