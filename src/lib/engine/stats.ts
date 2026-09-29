/**
 * Derived season stats for a City team (dashboard tiles, form, playoff summary).
 * See docs/points-engine.md, "Derived stats", for the rules (what counts, what is excluded).
 */
import type { PlayoffRound } from "@/lib/domain/types";
import type { TeamSeries } from "./context";
import type { TeamNight } from "./nights";

export interface Record2 {
  w: number;
  l: number;
}

export interface SeasonStats {
  /** Series W–L, forfeits included, byes excluded. */
  series: Record2 & { forfeitWins: number; forfeitLosses: number };
  /** Games W–L from series scores, forfeits excluded. */
  games: Record2;
  /** Series that went the distance (3–2 either way in a best-of-5, 4–3 in a best-of-7). */
  deciders: Record2;
  /** Points per scoring night (league nights, plus Swiss Stage 1 for a Swiss team). */
  nights: { count: number; total: number; avg: number | null; best: number | null; worst: number | null };
}

export function isDecider(ts: TeamSeries): boolean {
  if (ts.series.isForfeit || ts.our === null || ts.opp === null) return false;
  const toWin = Math.ceil(ts.series.bestOf / 2);
  return Math.max(ts.our, ts.opp) === toWin && Math.min(ts.our, ts.opp) === toWin - 1;
}

export function seasonStats(series: TeamSeries[], nights: TeamNight[]): SeasonStats {
  const played = series.filter((s) => s.result !== "BYE");
  const w = played.filter((s) => s.result === "W");
  const l = played.filter((s) => s.result === "L");
  const real = played.filter((s) => !s.series.isForfeit);
  const deciders = real.filter(isDecider);
  const pts = nights.map((n) => n.points).filter((p): p is number => p !== null);
  const total = pts.reduce((s, p) => s + p, 0);
  return {
    series: {
      w: w.length,
      l: l.length,
      forfeitWins: w.filter((s) => s.series.isForfeit).length,
      forfeitLosses: l.filter((s) => s.series.isForfeit).length,
    },
    games: {
      w: real.reduce((s, x) => s + (x.our ?? 0), 0),
      l: real.reduce((s, x) => s + (x.opp ?? 0), 0),
    },
    deciders: {
      w: deciders.filter((s) => s.result === "W").length,
      l: deciders.filter((s) => s.result === "L").length,
    },
    nights: {
      count: pts.length,
      total,
      avg: pts.length ? total / pts.length : null,
      best: pts.length ? Math.max(...pts) : null,
      worst: pts.length ? Math.min(...pts) : null,
    },
  };
}

/** Last N series, newest first, playoffs included, byes excluded. */
export function form(series: TeamSeries[], n = 5): TeamSeries[] {
  return series
    .filter((s) => s.result !== "BYE")
    .slice()
    .reverse()
    .slice(0, n);
}

export const PLAYOFF_ROUND_NAMES: Record<PlayoffRound, string> = {
  last32: "Last 32",
  last16: "Last 16",
  qf: "Quarter-final",
  sf: "Semi-final",
  final: "Final",
};

const ORDINAL_ROUND = ["Round 1", "Round 2", "Round 3", "Round 4", "Round 5"];

/**
 * 'Round 1 bye, lost Last 16 2–4 to Portsmouth Pirates'. Null when there are no playoff series.
 */
export function playoffSummary(series: TeamSeries[]): string | null {
  const po = series.filter((s) => s.series.stage === "playoff");
  if (!po.length) return null;
  const parts: string[] = [];
  po.forEach((s, i) => {
    const round = s.series.playoffRound ? PLAYOFF_ROUND_NAMES[s.series.playoffRound] : ORDINAL_ROUND[i];
    const score = `${s.our}–${s.opp}`;
    if (s.result === "BYE") parts.push(`${ORDINAL_ROUND[i] ?? round} bye`);
    else if (s.result === "W") parts.push(`beat ${s.opponent?.shortName} ${score} in the ${round}`);
    else parts.push(`lost ${round} ${score} to ${s.opponent?.shortName}`);
  });
  const last = po.at(-1)!;
  if (last.result === "W" && last.series.playoffRound === "final") parts.push("champions");
  return parts.join(", ");
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function fmtRecord(r: Record2): string {
  return `${r.w}–${r.l}`;
}
