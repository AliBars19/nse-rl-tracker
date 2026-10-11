import { describe, expect, it } from "vitest";
import { loadSeed } from "@/lib/data/seed";
import type { Dataset, Game, PlayerGameStat, Series } from "@/lib/domain/types";
import { ctxOf, ourTeam, seasonSeries } from "./context";
import { nightsForSeason } from "./nights";
import { playerLines, playerProfile, replayCoverage } from "./players";
import { opponentList } from "./scouting";
import { scrimResult, scrimScore, scrimSeries } from "./scrims";
import { fmtRecord, form, seasonStats } from "./stats";

/** The Spring 26 seed plus one scrim (and one league game) with replay stats. */
function withScrim(scores: { our: number | null; opp: number | null }): Dataset {
  const base = loadSeed("spring-26")!;
  const champs = ourTeam(base, "champions")!.team;
  const bears = base.teams.find((t) => t.name === "Royal Bears Rocket league")!;
  const caprillix = base.players.find((p) => p.nickname === "Caprillix")!;
  const leagueSeries = base.series.find((s) => s.nseMatchId === 182350)!; // Week 6 R3 vs Royal Bears

  const scrim: Series = {
    id: "scrim-1",
    seasonId: base.season.id,
    tier: "div2",
    nseMatchId: null,
    stage: "scrim",
    nightId: null,
    round: null,
    playoffRound: null,
    homeTeamId: champs.id,
    awayTeamId: bears.id,
    homeScore: scores.our,
    awayScore: scores.opp,
    bestOf: 5,
    isForfeit: false,
    playedAt: "2026-03-12T19:00:00.000Z",
  };
  const game = (id: string, seriesId: string, n: number, home: number, away: number): Game => ({
    id,
    seriesId,
    gameNumber: n,
    ballchasingId: id,
    homeGoals: home,
    awayGoals: away,
    overtime: false,
    processedAt: "2026-03-12T21:00:00.000Z",
  });
  const stat = (gameId: string, score: number, goals: number): PlayerGameStat => ({
    gameId,
    playerId: caprillix.id,
    teamId: champs.id,
    displayName: "Caprillix",
    score,
    goals,
    assists: 1,
    saves: 2,
    shots: 4,
    mvp: false,
  });
  return {
    ...base,
    series: [...base.series, scrim],
    games: [game("g-s1", "scrim-1", 1, 3, 1), game("g-s2", "scrim-1", 2, 1, 2), game("g-l1", leagueSeries.id, 1, 2, 1)],
    playerGameStats: [stat("g-s1", 700, 3), stat("g-s2", 300, 1), stat("g-l1", 400, 1)],
  };
}

describe("scrims never count towards team results", () => {
  const ds = withScrim({ our: 2, opp: 1 });
  const ctx = ctxOf(ds);
  const champs = ourTeam(ds, "champions")!.team;
  const season = seasonSeries(ctx, champs.id, "div2");
  const nights = nightsForSeason(ctx, champs.id, "div2");

  it("is left out of the season's series, records and form", () => {
    expect(season.some((s) => s.series.stage === "scrim")).toBe(false);
    const stats = seasonStats(season, nights);
    expect(fmtRecord(stats.series)).toBe("6–7");
    expect(fmtRecord(stats.games)).toBe("25–30");
    expect(form(season)[0].opponent?.shortName).toBe("Portsmouth Pirates");
  });

  it("does not change league nights, points or scouting", () => {
    expect(nights.map((n) => n.points)).toEqual([4, 6, 4, 6]);
    const bears = opponentList(season).find((o) => o.team.shortName === "Royal Bears")!;
    expect(bears.meta).toBe("3 meetings");
  });

  it("is listed on its own", () => {
    expect(scrimSeries(ctx, champs.id).map((s) => [s.series.id, s.opponent?.shortName])).toEqual([["scrim-1", "Royal Bears"]]);
  });
});

describe("scrim scores", () => {
  it("uses the entered score", () => {
    const ds = withScrim({ our: 2, opp: 1 });
    const ctx = ctxOf(ds);
    const s = scrimSeries(ctx, ourTeam(ds, "champions")!.team.id)[0];
    expect(scrimScore(ctx, s)).toEqual({ our: 2, opp: 1, source: "entered" });
    expect(scrimResult(scrimScore(ctx, s))).toBe("W");
  });

  it("falls back to the uploaded replays, and allows a draw", () => {
    const ds = withScrim({ our: null, opp: null });
    const ctx = ctxOf(ds);
    const s = scrimSeries(ctx, ourTeam(ds, "champions")!.team.id)[0];
    expect(scrimScore(ctx, s)).toEqual({ our: 1, opp: 1, source: "replays" });
    expect(scrimResult(scrimScore(ctx, s))).toBe("D");
  });

  it("is unknown with no score and no replays", () => {
    const ds = withScrim({ our: null, opp: null });
    const ctx = ctxOf({ ...ds, games: [], playerGameStats: [] });
    const s = scrimSeries(ctx, ourTeam(ds, "champions")!.team.id)[0];
    expect(scrimScore(ctx, s)).toBeNull();
    expect(scrimResult(null)).toBeNull();
  });
});

describe("scrims count towards player stats", () => {
  const ds = withScrim({ our: 2, opp: 1 });
  const ctx = ctxOf(ds);
  const champs = ourTeam(ds, "champions")!.team;
  const season = seasonSeries(ctx, champs.id, "div2");
  const scrims = scrimSeries(ctx, champs.id);
  const nights = nightsForSeason(ctx, champs.id, "div2");

  it("adds scrim games to the leaderboard", () => {
    const cap = playerLines(ctx, champs.id, [...season, ...scrims]).find((l) => l.player.nickname === "Caprillix")!;
    expect(cap.gp).toBe(3);
    expect(cap.totals).toMatchObject({ score: 1400, goals: 5 });
    const leagueOnly = playerLines(ctx, champs.id, season).find((l) => l.player.nickname === "Caprillix")!;
    expect(leagueOnly.gp).toBe(1);
  });

  it("shows a SCRIMS column and can pick a scrim as the best game", () => {
    const cap = ds.players.find((p) => p.nickname === "Caprillix")!;
    const profile = playerProfile(ctx, cap.id, season, nights, scrims);
    expect(profile.avgByNight.at(-1)).toEqual({ label: "SCRIMS", avg: 500 });
    expect(profile.avgByNight.find((n) => n.label === "WK 6")?.avg).toBe(400);
    expect(profile.best).toMatchObject({ opponent: "Royal Bears", night: "Scrim", score: 700 });
  });

  it("keeps the matchday replay coverage separate from scrims", () => {
    expect(replayCoverage(ctx, season)).toEqual({ processed: 1, total: 55 });
  });
});
