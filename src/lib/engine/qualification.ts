/**
 * Stage 1 qualification (NSE Winter 26): six rounds over two nights, and four series wins send a team
 * to Division 1; everyone else goes to the Swiss. Worked out from the sheet's groups ("need N more wins
 * for Div 1") and confirmed by Ali, not published by NSE: change the numbers here if NSE says otherwise.
 *
 * Pure: the page adapter below turns a team's Stage 1 series into results.
 */
import type { TeamSeries } from "./context";

export interface QualificationRules {
  rounds: number;
  winsForDiv1: number;
}

/** Per season slug. A season with no entry has no Stage 1 qualification view. */
export const QUALIFICATION_RULES: Record<string, QualificationRules> = {
  "winter-26": { rounds: 6, winsForDiv1: 4 },
};

export interface Stage1Result {
  round: number;
  opponent: string;
  won: boolean;
  score: string; // '3–1', City's games first
}

export interface Qualification {
  rules: QualificationRules;
  wins: number;
  losses: number;
  played: number;
  remaining: number;
  /** Wins still needed for Div 1 (0 once qualified). */
  needed: number;
  status: "qualified" | "alive" | "out";
  headline: string;
  detail: string;
  /** One slot per round of Stage 1, in order. */
  rounds: Array<{ round: number; result: Stage1Result | null }>;
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six"];

export function qualification(results: Stage1Result[], rules: QualificationRules): Qualification {
  const wins = results.filter((r) => r.won).length;
  const losses = results.length - wins;
  const played = results.length;
  const remaining = Math.max(0, rules.rounds - played);
  const needed = Math.max(0, rules.winsForDiv1 - wins);

  const status: Qualification["status"] = needed === 0 ? "qualified" : needed > remaining ? "out" : "alive";
  let headline: string;
  let detail: string;
  if (status === "qualified") {
    headline = "Div 1 secured";
    detail = `${wins} wins from ${played} ${played === 1 ? "round" : "rounds"}`;
  } else if (status === "out") {
    headline = "Swiss";
    detail =
      remaining === 0
        ? `Finished on ${wins} ${wins === 1 ? "win" : "wins"}, short of ${rules.winsForDiv1}`
        : `Can't reach ${rules.winsForDiv1} wins: ${wins} won, ${remaining} ${remaining === 1 ? "round" : "rounds"} left`;
  } else {
    headline = `Need ${needed} more ${needed === 1 ? "win" : "wins"}`;
    if (played === 0) detail = `Win ${needed} of the ${rules.rounds} rounds`;
    else if (needed === remaining) detail = remaining === 1 ? "Win the last round" : remaining === 2 ? "Win both remaining rounds" : `Win all ${WORDS[remaining] ?? remaining} rounds`;
    else detail = `Win ${needed} of the last ${remaining} rounds`;
  }

  const byRound = new Map(results.map((r) => [r.round, r]));
  return {
    rules,
    wins,
    losses,
    played,
    remaining,
    needed,
    status,
    headline,
    detail,
    rounds: Array.from({ length: rules.rounds }, (_, i) => ({ round: i + 1, result: byRound.get(i + 1) ?? null })),
  };
}

/** A team's Stage 1 series as results (byes and unscored series are left out; a forfeit win is still a win). */
export function stage1Results(series: TeamSeries[]): Stage1Result[] {
  return series
    .filter((s) => s.series.stage === "placement" && s.opponent && s.our !== null && s.opp !== null)
    .map((s, i) => ({
      round: s.series.round ?? i + 1,
      opponent: s.opponent!.shortName,
      won: (s.our ?? 0) > (s.opp ?? 0),
      score: `${s.our}–${s.opp}`,
    }))
    .sort((a, b) => a.round - b.round);
}
