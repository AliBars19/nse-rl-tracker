/**
 * Player stats from uploaded replays (ballchasing). Nothing here invents numbers:
 * with no replays every value is null and the UI shows placeholders.
 */
import type { Game, Player, PlayerGameStat, RosterRole } from "@/lib/domain/types";
import type { Ctx, TeamSeries } from "./context";
import type { TeamNight } from "./nights";

export const MIN_GAMES_TO_RANK = 3;

export interface StatTotals {
  score: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  mvps: number;
}

export interface PlayerLine {
  player: Player;
  role: RosterRole;
  gp: number;
  totals: StatTotals;
  perGame: StatTotals | null;
  shootingPct: number | null;
  ranked: boolean;
}

const ZERO: StatTotals = { score: 0, goals: 0, assists: 0, saves: 0, shots: 0, mvps: 0 };

function add(t: StatTotals, s: PlayerGameStat): StatTotals {
  return {
    score: t.score + (s.score ?? 0),
    goals: t.goals + (s.goals ?? 0),
    assists: t.assists + (s.assists ?? 0),
    saves: t.saves + (s.saves ?? 0),
    shots: t.shots + (s.shots ?? 0),
    mvps: t.mvps + (s.mvp ? 1 : 0),
  };
}

function div(t: StatTotals, n: number): StatTotals {
  return {
    score: t.score / n,
    goals: t.goals / n,
    assists: t.assists / n,
    saves: t.saves / n,
    shots: t.shots / n,
    mvps: t.mvps / n,
  };
}

/** Processed games (replays with stats) that belong to the given series. */
export function processedGames(ctx: Ctx, seriesIds: Set<string>): Game[] {
  return ctx.ds.games.filter((g) => seriesIds.has(g.seriesId) && g.processedAt);
}

/** '0 / 55 games': replays with stats vs games actually played (forfeits excluded). */
export function replayCoverage(ctx: Ctx, season: TeamSeries[]): { processed: number; total: number } {
  const real = season.filter((s) => s.result !== "BYE" && !s.series.isForfeit);
  const total = real.reduce((n, s) => n + (s.our ?? 0) + (s.opp ?? 0), 0);
  const processed = processedGames(ctx, new Set(real.map((s) => s.series.id))).length;
  return { processed, total };
}

export function playerLines(ctx: Ctx, teamId: string, season: TeamSeries[]): PlayerLine[] {
  const { ds } = ctx;
  const roster = ds.roster.filter((r) => r.teamId === teamId && r.seasonId === ds.season.id);
  const games = processedGames(ctx, new Set(season.map((s) => s.series.id)));
  const gameIds = new Set(games.map((g) => g.id));
  const stats = ds.playerGameStats.filter((s) => gameIds.has(s.gameId) && s.playerId);

  return roster
    .map((r) => {
      const player = ds.players.find((p) => p.id === r.playerId)!;
      const mine = stats.filter((s) => s.playerId === player.id);
      const totals = mine.reduce(add, ZERO);
      const gp = new Set(mine.map((s) => s.gameId)).size;
      return {
        player,
        role: r.role,
        gp,
        totals,
        perGame: gp ? div(totals, gp) : null,
        shootingPct: totals.shots ? (totals.goals / totals.shots) * 100 : null,
        ranked: gp >= MIN_GAMES_TO_RANK,
      };
    })
    .sort((a, b) => (a.role === "leader" ? -1 : 0) - (b.role === "leader" ? -1 : 0));
}

export interface Leader {
  label: string;
  unit: string;
  line: PlayerLine | null;
  value: number | null;
}

export function leaders(lines: PlayerLine[]): Leader[] {
  const ranked = lines.filter((l) => l.ranked && l.perGame);
  const best = (label: string, unit: string, pick: (t: StatTotals) => number): Leader => {
    const top = [...ranked].sort((a, b) => pick(b.perGame!) - pick(a.perGame!))[0] ?? null;
    return { label, unit, line: top, value: top ? pick(top.perGame!) : null };
  };
  return [
    best("TOP SCORER", "goals / game", (t) => t.goals),
    best("MOST SAVES", "saves / game", (t) => t.saves),
    best("PLAYMAKER", "assists / game", (t) => t.assists),
    best("HIGHEST AVG SCORE", "score / game", (t) => t.score),
  ];
}

export interface PlayerProfile {
  avgByNight: Array<{ label: string; avg: number | null }>;
  best: { opponent: string; night: string; goals: number; assists: number; saves: number; score: number } | null;
}

export function playerProfile(ctx: Ctx, playerId: string, season: TeamSeries[], nights: TeamNight[]): PlayerProfile {
  const games = processedGames(ctx, new Set(season.map((s) => s.series.id)));
  const stats = ctx.ds.playerGameStats.filter((s) => s.playerId === playerId);
  const gameById = new Map(games.map((g) => [g.id, g]));
  const seriesById = new Map(season.map((s) => [s.series.id, s]));

  const avgByNight = nights.map((n) => {
    const ids = new Set(n.rounds.map((r) => r.ts.series.id));
    const mine = stats.filter((s) => {
      const g = gameById.get(s.gameId);
      return g && ids.has(g.seriesId);
    });
    const avg = mine.length ? mine.reduce((t, s) => t + (s.score ?? 0), 0) / mine.length : null;
    return { label: n.night.stage === "placement" ? "STG 1" : `WK ${n.night.week}`, avg };
  });

  let best: PlayerProfile["best"] = null;
  for (const s of stats) {
    const g = gameById.get(s.gameId);
    if (!g) continue;
    if (best && (s.score ?? 0) <= best.score) continue;
    const ts = seriesById.get(g.seriesId);
    best = {
      opponent: ts?.opponent?.shortName ?? "—",
      night: ts?.night?.label ?? "Playoffs",
      goals: s.goals ?? 0,
      assists: s.assists ?? 0,
      saves: s.saves ?? 0,
      score: s.score ?? 0,
    };
  }
  return { avgByNight, best };
}

/** Scoreboard for one side of one series: per-player totals across its processed games. */
export function seriesScoreboard(ctx: Ctx, seriesId: string, teamId: string) {
  const games = ctx.ds.games.filter((g) => g.seriesId === seriesId && g.processedAt);
  const ids = new Set(games.map((g) => g.id));
  const rows = new Map<string, StatTotals & { name: string }>();
  for (const s of ctx.ds.playerGameStats) {
    if (!ids.has(s.gameId) || s.teamId !== teamId) continue;
    const key = s.playerId ?? s.displayName;
    const name = ctx.ds.players.find((p) => p.id === s.playerId)?.nickname ?? s.displayName;
    const prev = rows.get(key) ?? { ...ZERO, name };
    rows.set(key, { ...add(prev, s), name });
  }
  return [...rows.values()].sort((a, b) => b.score - a.score);
}
