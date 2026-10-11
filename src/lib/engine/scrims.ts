/**
 * Scrims: practice series played outside NSE matchdays. They feed player stats (through their
 * uploaded replays) but never points, standings, series/game records, form or scouting.
 */
import { fromSide, type Ctx, type TeamSeries } from "./context";

/** A City team's scrims this season, oldest first. */
export function scrimSeries(ctx: Ctx, teamId: string): TeamSeries[] {
  return (ctx.seriesByTeam.get(teamId) ?? [])
    .filter((s) => s.stage === "scrim" && s.seasonId === ctx.ds.season.id)
    .map((s) => fromSide(ctx, s, teamId))
    .sort((a, b) => (a.series.playedAt ?? "").localeCompare(b.series.playedAt ?? ""));
}

export interface ScrimScore {
  our: number;
  opp: number;
  /** 'entered' by the admin, or counted from the uploaded 'replays' when no score was entered. */
  source: "entered" | "replays";
}

/** Game score for a scrim: the entered score, else game wins counted from processed replays. */
export function scrimScore(ctx: Ctx, ts: TeamSeries): ScrimScore | null {
  if (ts.our !== null && ts.opp !== null) return { our: ts.our, opp: ts.opp, source: "entered" };
  const home = ts.series.homeTeamId === ts.teamId;
  let our = 0;
  let opp = 0;
  for (const g of ctx.ds.games) {
    if (g.seriesId !== ts.series.id || !g.processedAt || g.homeGoals === null || g.awayGoals === null) continue;
    const [us, them] = home ? [g.homeGoals, g.awayGoals] : [g.awayGoals, g.homeGoals];
    if (us > them) our++;
    else if (them > us) opp++;
  }
  return our + opp > 0 ? { our, opp, source: "replays" } : null;
}

/** Scrims can be drawn (an even block of games), unlike NSE series. */
export function scrimResult(score: ScrimScore | null): "W" | "L" | "D" | null {
  if (!score) return null;
  return score.our > score.opp ? "W" : score.our < score.opp ? "L" : "D";
}
