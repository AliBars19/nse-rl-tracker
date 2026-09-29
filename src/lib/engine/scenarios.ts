/**
 * Scenarios: what each possible night does to a team's total, and which rivals it can
 * pass or be passed by. Pure function of (going-in totals, R1 opponent, ladder).
 *
 * Copy rule (Ali): never say "win the 1–0 match" or "the 2–0 match"; those read like
 * scorelines. Use "Winners' match", "Round 3", "Win all three", "Split R1 + R2, win R3", ...
 */
import { effectOf, LADDER_ORDER, possiblePoints, type Effect } from "./points";
import { TIER_NAMES, type Bracket, type LadderKey, type Ruleset } from "./rulesets";
import { sharedRanks } from "./standings";
import { ordinal } from "./stats";

export interface ScenarioTeam {
  teamId: string;
  name: string;
  total: number;
}

export interface ScenarioInput {
  ruleset: Ruleset;
  /** Every team in the table going in, including us. */
  table: ScenarioTeam[];
  ourTeamId: string;
  r1Opponent: string | null;
  /** How far above/below us a team can be and still count as a rival. */
  rivalWindow?: number;
}

export interface Outcome {
  key: LadderKey;
  bracket: Bracket;
  r3: "W" | "L";
  /** Desktop card row: 'Win Round 3'. */
  label: string;
  /** Phone row: 'Split R1 + R2, win R3'. */
  plain: string;
  points: number;
  total: number;
  effect: Effect;
  effectText: string;
}

export interface OutcomeGroup {
  bracket: Bracket;
  title: string; // 'Go 2–0'
  how: string; // 'Win Rounds 1 and 2'
  outcomes: Outcome[];
}

export interface Rival {
  teamId: string;
  name: string;
  total: number;
  /** their total minus ours */
  gap: number;
  gapText: string; // '+2 ahead' | 'level' | '2 behind'
  note: string;
}

export interface Scenarios {
  goingIn: { total: number; rank: number; tied: boolean; text: string };
  headline: { r1Opponent: string | null; promotedTo: string | null; maxPoints: number };
  groups: OutcomeGroup[];
  outcomes: Outcome[];
  rivals: Rival[];
}

const PLAIN: Record<LadderKey, string> = {
  "2-0:W": "Win all three",
  "2-0:L": "Win R1 + R2, lose R3",
  "1-1:W": "Split R1 + R2, win R3",
  "1-1:L": "Split R1 + R2, lose R3",
  "0-2:W": "Lose R1 + R2, win R3",
  "0-2:L": "Lose all three",
};

const GROUPS: Array<{ bracket: Bracket; title: string; how: string }> = [
  { bracket: "2-0", title: "Go 2–0", how: "Win Rounds 1 and 2" },
  { bracket: "1-1", title: "Go 1–1", how: "Split Rounds 1 and 2" },
  { bracket: "0-2", title: "Go 0–2", how: "Lose Rounds 1 and 2" },
];

function effectText(effect: Effect, ruleset: Ruleset): string {
  const here = TIER_NAMES[ruleset.tier].long;
  if (effect === "promoted" && ruleset.promotesTo) return `Promoted to ${TIER_NAMES[ruleset.promotesTo].long}`;
  if (effect === "relegated" && ruleset.relegatesTo) return `Relegated to ${TIER_NAMES[ruleset.relegatesTo].long}`;
  return `Stay in ${here}`;
}

function gapText(gap: number): string {
  if (gap === 0) return "level";
  return gap > 0 ? `+${gap} ahead` : `${-gap} behind`;
}

/** Largest points difference two teams can have after one night under this ladder. */
export function maxSwing(ruleset: Ruleset): number {
  const vals = possiblePoints(ruleset.ladder!);
  return vals[0] - vals[vals.length - 1];
}

function rivalNote(gap: number, swing: number, theirRank: number, ruleset: Ruleset): string {
  const lines = ruleset.playoffLines;
  let prefix = "";
  if (lines && gap > 0 && theirRank === lines.byeR1R2) prefix = "Holds the last top-4 spot. ";
  else if (lines && gap > 0 && theirRank === lines.byeR1) prefix = "Holds the last top-8 spot. ";
  if (gap === 0) return "Outscore them tonight to finish above.";
  if (gap > 0) {
    const need = gap + 1;
    return need > swing ? `${prefix}Out of reach this week.`.trim() : `${prefix}Outscore them by ${need}+ to pass them.`;
  }
  const need = -gap + 1;
  return need > swing ? "Cannot pass you this week." : `They pass you only if they outscore you by ${need}+.`;
}

export function buildScenarios(input: ScenarioInput): Scenarios | null {
  const { ruleset, table, ourTeamId, r1Opponent } = input;
  if (!ruleset.ladder) return null;
  const us = table.find((t) => t.teamId === ourTeamId);
  if (!us) return null;

  const ranks = sharedRanks(table.map((t) => t.total));
  const rankOf = (id: string) => ranks[table.findIndex((t) => t.teamId === id)];
  const ourRank = rankOf(ourTeamId);
  const tied = table.filter((t) => t.total === us.total).length > 1;

  const outcomes: Outcome[] = LADDER_ORDER.map((key) => {
    const [bracket, r3] = key.split(":") as [Bracket, "W" | "L"];
    const points = ruleset.ladder![key];
    const effect = effectOf(key, ruleset);
    return {
      key,
      bracket,
      r3,
      label: r3 === "W" ? "Win Round 3" : "Lose Round 3",
      plain: PLAIN[key],
      points,
      total: us.total + points,
      effect,
      effectText: effectText(effect, ruleset),
    };
  });

  const window = input.rivalWindow ?? 6;
  const swing = maxSwing(ruleset);
  const rivals: Rival[] = table
    .filter((t) => t.teamId !== ourTeamId && Math.abs(t.total - us.total) <= window)
    .sort((a, b) => b.total - a.total)
    .map((t) => {
      const gap = t.total - us.total;
      return {
        teamId: t.teamId,
        name: t.name,
        total: t.total,
        gap,
        gapText: gapText(gap),
        note: rivalNote(gap, swing, rankOf(t.teamId), ruleset),
      };
    });

  return {
    goingIn: {
      total: us.total,
      rank: ourRank,
      tied,
      text: `${tied ? "joint " : ""}${ordinal(ourRank)} · ${us.total} pts`,
    },
    headline: {
      r1Opponent,
      promotedTo: ruleset.promotesTo ? TIER_NAMES[ruleset.promotesTo].long : null,
      maxPoints: ruleset.ladder["2-0:W"],
    },
    groups: GROUPS.map((g) => ({ ...g, outcomes: outcomes.filter((o) => o.bracket === g.bracket) })),
    outcomes,
    rivals,
  };
}
