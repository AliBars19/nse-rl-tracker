/**
 * The points engine: turns one night's round results into points.
 *
 * NSE league nights are a three-round mini Swiss of best-of-5 series:
 *   R1 everyone plays; R2 winners play winners (Winners' match) and losers play losers
 *   (Losers' match); R3 pairs teams by record: 2–0 (Promotion match), 1–1 (decider),
 *   0–2 (Relegation match). The ladder maps (record after R2, R3 result) to points.
 *
 * Forfeit wins count as wins. A Round 3 bye (Week 3: odd number of 2–0 teams) counts as
 * winning Round 3.
 */
import type { Bracket, Ladder, LadderKey, Ruleset } from "./rulesets";

export type RoundResult = "W" | "L" | "BYE";

export interface NightPoints {
  points: number;
  bracket: Bracket;
  r3: "W" | "L";
  r3Bye: boolean;
  key: LadderKey;
  /** Short path text: '1–1, won decider'. */
  path: string;
  promoted: boolean;
  relegated: boolean;
}

export function bracketOf(r1: RoundResult, r2: RoundResult): Bracket {
  const w = (r: RoundResult) => r !== "L";
  if (w(r1) && w(r2)) return "2-0";
  if (!w(r1) && !w(r2)) return "0-2";
  return "1-1";
}

const R3_NAMES: Record<Bracket, string> = {
  "2-0": "promotion match",
  "1-1": "decider",
  "0-2": "relegation match",
};

export function describePath(bracket: Bracket, r3: "W" | "L", r3Bye = false): string {
  const rec = bracket.replace("-", "–");
  if (r3Bye) return `${rec}, Round 3 bye`;
  return `${rec}, ${r3 === "W" ? "won" : "lost"} ${R3_NAMES[bracket]}`;
}

export function nightPoints(
  r1: RoundResult,
  r2: RoundResult,
  r3: RoundResult,
  ladder: Ladder,
  opts: { promotes?: boolean; relegates?: boolean } = {},
): NightPoints {
  const bracket = bracketOf(r1, r2);
  const r3res: "W" | "L" = r3 === "L" ? "L" : "W";
  const key: LadderKey = `${bracket}:${r3res}`;
  const promotes = opts.promotes ?? true;
  const relegates = opts.relegates ?? true;
  return {
    points: ladder[key],
    bracket,
    r3: r3res,
    r3Bye: r3 === "BYE",
    key,
    path: describePath(bracket, r3res, r3 === "BYE"),
    promoted: promotes && key === "2-0:W",
    relegated: relegates && key === "0-2:L",
  };
}

/** Every possible night for a ladder, best first. Used by 'How nights score' and Scenarios. */
export const LADDER_ORDER: LadderKey[] = ["2-0:W", "2-0:L", "1-1:W", "1-1:L", "0-2:W", "0-2:L"];

export type Effect = "promoted" | "stay" | "relegated";

export function effectOf(key: LadderKey, ruleset: Ruleset): Effect {
  if (key === "2-0:W" && ruleset.promotesTo) return "promoted";
  if (key === "0-2:L" && ruleset.relegatesTo) return "relegated";
  return "stay";
}

/** Distinct points values a night can produce under a ladder. */
export function possiblePoints(ladder: Ladder): number[] {
  return [...new Set(Object.values(ladder))].sort((a, b) => b - a);
}

/** Round label from the record going into the round (approved design copy). */
export function roundLabel(
  round: number,
  recordBefore: { w: number; l: number },
  style: Ruleset["roundStyle"],
  stage: "placement" | "league" = "league",
): string {
  if (stage === "placement") return `Round ${round}`;
  if (round === 1) return "Opener";
  if (round === 2) return recordBefore.w > recordBefore.l ? "Winners’ match" : "Losers’ match";
  if (style === "swiss") return round === 3 ? "Round 3" : round === 4 ? "Promotion match" : `Round ${round}`;
  if (round === 3) {
    if (recordBefore.w === 2) return "Promotion match";
    if (recordBefore.l === 2) return "Relegation match";
    return "1–1 decider";
  }
  return `Round ${round}`;
}
