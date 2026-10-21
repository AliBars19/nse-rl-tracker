import { describe, expect, it } from "vitest";
import { loadSeed } from "@/lib/data/seed";
import type { Dataset, Game, PlayerGameStat } from "@/lib/domain/types";
import { ctxOf, ourTeam, seasonSeries } from "./context";
import { gameScoreboard, playerAdvanced } from "./players";
import { opponentInsights } from "./scouting";

/** Spring 26 seed + two replayed games of Champions' Week 6 Round 3 vs Royal Bears (they are the home side's opposite). */
function setup(extras = true) {
  const base = loadSeed("spring-26")!;
  const champs = ourTeam(base, "champions")!;
  const bears = base.teams.find((t) => t.name === "Royal Bears Rocket league")!;
  const series = base.series.find((s) => s.nseMatchId === 182350)!;
  const cityHome = series.homeTeamId === champs.team.id;
  const caprillix = base.players.find((p) => p.nickname === "Caprillix")!;

  // City 3–1 up in goals game 1, lost game 2 (from City's side)
  const mkGame = (n: number, city: number, them: number): Game => ({
    id: `g${n}`,
    seriesId: series.id,
    gameNumber: n,
    ballchasingId: `bc${n}`,
    homeGoals: cityHome ? city : them,
    awayGoals: cityHome ? them : city,
    overtime: false,
    processedAt: "2026-03-12T21:00:00.000Z",
  });
  const row = (gameId: string, teamId: string, name: string, playerId: string | null, v: Partial<PlayerGameStat>): PlayerGameStat => ({
    gameId,
    playerId,
    teamId,
    displayName: name,
    score: 0,
    goals: 0,
    assists: 0,
    saves: 0,
    shots: 0,
    mvp: false,
    ...v,
  });
  const ex = (bpm: number | null, speed: number | null, demos: number | null) =>
    extras ? { bpm, avgSpeed: speed, percentSupersonic: speed === null ? null : 20, demosInflicted: demos, demosTaken: 1 } : undefined;
  const stats: PlayerGameStat[] = [
    row("g1", champs.team.id, "Caprillix", caprillix.id, { score: 500, goals: 2, shots: 3, extras: ex(400, 1500, 2) }),
    row("g1", bears.id, "Bear1", null, { score: 300, goals: 1, shots: 2, saves: 3 }),
    row("g1", bears.id, "Bear2", null, { score: 200, goals: 0, shots: 4, saves: 1 }),
    row("g2", champs.team.id, "Caprillix", caprillix.id, { score: 100, goals: 0, shots: 1, extras: ex(300, null, null) }),
    row("g2", bears.id, "bear1", null, { score: 600, goals: 3, shots: 5, saves: 0 }),
  ];
  const ds: Dataset = {
    ...base,
    games: [...base.games.filter((g) => g.seriesId !== series.id), mkGame(1, 2, 1), mkGame(2, 0, 3)],
    playerGameStats: [...base.playerGameStats.filter((s) => !["g1", "g2"].includes(s.gameId)), ...stats],
  };
  const ctx = ctxOf(ds);
  const mine = seasonSeries(ctx, champs.team.id, champs.teamSeason.tier);
  return { ctx, champs, bears, caprillix, series, meetings: mine.filter((s) => s.series.id === series.id) };
}

describe("gameScoreboard", () => {
  it("lists one game's players for one team, best score first, linked names used", () => {
    const { ctx, bears, champs } = setup();
    const rows = gameScoreboard(ctx, "g1", bears.id);
    expect(rows.map((r) => [r.name, r.score])).toEqual([["Bear1", 300], ["Bear2", 200]]);
    expect(gameScoreboard(ctx, "g1", champs.team.id)).toMatchObject([{ name: "Caprillix", score: 500, goals: 2 }]);
    expect(gameScoreboard(ctx, "nope", bears.id)).toEqual([]);
  });
});

describe("opponentInsights", () => {
  it("summarises an opponent's players across the games we have replays for", () => {
    const { ctx, bears, meetings } = setup();
    const i = opponentInsights(ctx, meetings, bears.id)!;
    expect(i.games).toBe(2);
    expect(i.cityGames).toEqual({ won: 1, lost: 1 });
    // names are merged case-insensitively: Bear1 appears in both games
    expect(i.players.map((p) => [p.name, p.gp])).toEqual([["Bear1", 2], ["Bear2", 1]]);
    expect(i.topScorer).toEqual({ name: "Bear1", goals: 4, gp: 2 });
    expect(i.players[0]).toMatchObject({ goals: 2, shots: 3.5, saves: 1.5, score: 450 }); // per game
    expect(i.team).toEqual({ goals: 2, shots: 5.5, saves: 2 });
  });

  it("is null when there are no replays", () => {
    const { ctx, bears, champs } = setup();
    const none = seasonSeries(ctx, champs.team.id, champs.teamSeason.tier).filter((s) => s.series.nseMatchId !== 182350);
    expect(opponentInsights(ctx, none, bears.id)).toBeNull();
  });
});

describe("playerAdvanced", () => {
  it("averages boost, speed and demos over the games that have them", () => {
    const { ctx, caprillix, champs } = setup();
    const season = seasonSeries(ctx, champs.team.id, champs.teamSeason.tier);
    const a = playerAdvanced(ctx, caprillix.id, season)!;
    expect(a.games).toBe(2);
    expect(a.bpm).toBe(350); // (400 + 300) / 2
    expect(a.avgSpeed).toBe(1500); // only game 1 has speed
    expect(a.demosPerGame).toBe(2); // only game 1 has demos
  });

  it("is null without any advanced stats (older replays, seed data)", () => {
    const { ctx, caprillix, champs } = setup(false);
    expect(playerAdvanced(ctx, caprillix.id, seasonSeries(ctx, champs.team.id, champs.teamSeason.tier))).toBeNull();
  });
});
