/**
 * Points ladders per season and tier. Data, not code paths: add a season by adding an entry.
 * See docs/points-engine.md for how each ladder was derived and how sure we are of it.
 */
import type { Tier } from "@/lib/domain/types";

/** Record after Rounds 1 and 2. */
export type Bracket = "2-0" | "1-1" | "0-2";
export type LadderKey = `${Bracket}:${"W" | "L"}`;
export type Ladder = Record<LadderKey, number>;

export type RulesetStatus =
  /** Checked against every result we have. */
  | "verified"
  /** Worked out from NSE results, not confirmed by NSE. */
  | "derived"
  /** No reliable ladder: points come from the standings sheet only. */
  | "unknown";

export interface Ruleset {
  seasonSlug: string;
  tier: Tier;
  status: RulesetStatus;
  /** How the ladder was established, shown in docs and the admin UI. */
  note: string;
  ladder: Ladder | null;
  promotesTo: Tier | null;
  relegatesTo: Tier | null;
  /** 'bracket': R3 opponents come from the R1+R2 record. 'swiss': plain Swiss rounds + promotion match. */
  roundStyle: "bracket" | "swiss";
  /** Playoff seeding lines: ranks 1..byeR1R2 get byes in Rounds 1 and 2, ..byeR1 in Round 1. */
  playoffLines: { byeR1R2: number; byeR1: number } | null;
}

export const TIER_NAMES: Record<Tier, { long: string; short: string }> = {
  div1: { long: "Division 1", short: "Div 1" },
  div2: { long: "Division 2", short: "Div 2" },
  swiss: { long: "Swiss", short: "Swiss" },
};

export const DIV2_LADDER: Ladder = {
  "2-0:W": 10,
  "2-0:L": 7,
  "1-1:W": 6,
  "1-1:L": 4,
  "0-2:W": 2,
  "0-2:L": 0,
};

const RULESETS: Ruleset[] = [
  {
    seasonSlug: "spring-26",
    tier: "div2",
    status: "verified",
    note:
      "Checked against every Division 2 team in Weeks 3–6. Three 1–1 Round 3 losers were given 6 instead of 4 " +
      "(Fake Warwick Wk 4, Swansea Storm Wk 5, Lincoln Swans Wk 6); every other team matches.",
    ladder: DIV2_LADDER,
    promotesTo: "div1",
    relegatesTo: "swiss",
    roundStyle: "bracket",
    playoffLines: { byeR1R2: 4, byeR1: 8 },
  },
  {
    seasonSlug: "spring-26",
    tier: "div1",
    status: "unknown",
    note:
      "Week 3 used 10/7/6/4/3/0. From Week 4 Division 1 split into two groups: upper 15/12/11/9/8/6 and " +
      "lower 8/6/5/3/2/0. Not modelled until a City team plays in Division 1.",
    ladder: null,
    promotesTo: null,
    relegatesTo: "div2",
    roundStyle: "bracket",
    playoffLines: null,
  },
  {
    seasonSlug: "spring-26",
    tier: "swiss",
    status: "unknown",
    note:
      "Swiss points depend on more than the win count (2 wins scored 8 or 7, 1 win 7 or 5, 0 wins 5 or 3), " +
      "and 3–0 teams play a promotion match. Points come from the NSE sheet until the rules are confirmed.",
    ladder: null,
    promotesTo: "div2",
    relegatesTo: null,
    roundStyle: "swiss",
    playoffLines: null,
  },
];

export function getRuleset(seasonSlug: string, tier: Tier): Ruleset {
  const found = RULESETS.find((r) => r.seasonSlug === seasonSlug && r.tier === tier);
  if (found) return found;
  // A new season with no entry yet: reuse the latest known rules for the tier.
  const latest = RULESETS.filter((r) => r.tier === tier).at(-1);
  if (!latest) throw new Error(`No ruleset for tier ${tier}`);
  return { ...latest, seasonSlug, status: latest.status === "verified" ? "derived" : latest.status };
}
