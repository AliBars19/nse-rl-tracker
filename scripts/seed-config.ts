/**
 * Hand-maintained facts for the Spring 26 seed that are not in the NSE match tables
 * or the standings sheet. Edit this, then run `npm run seed:build`.
 */
import type { RosterRole, Tier, TeamKey } from "../src/lib/domain/types";

export const SEASON = {
  slug: "spring-26",
  name: "NSE Spring 26",
  shortName: "Spring 26",
  isCurrent: true,
  isFinished: true,
};

/** Which NSE snapshot files feed each tier. */
export const TIERS: Array<{
  tier: Tier;
  tournament: string;
  sheet: string; // seed-data/*.csv
  /** [week, snapshot page, night label] */
  nights: Array<{ week: number; pages: string[]; label: string; stage: "placement" | "league" }>;
}> = [
  {
    tier: "div2",
    tournament: "rocket-league-nse-spring-26-division-2",
    sheet: "division-2.csv",
    nights: [3, 4, 5, 6].map((week) => ({
      week,
      pages: [`week-${week}`],
      label: `Week ${week}`,
      stage: "league" as const,
    })),
  },
  {
    tier: "swiss",
    tournament: "rocket-league-nse-spring-26",
    sheet: "swiss.csv",
    nights: [
      { week: 1, pages: ["stage-1"], label: "Stage 1", stage: "placement" as const },
      ...[3, 4, 5, 6].map((week) => ({
        week,
        pages: [`week-${week}`],
        label: `Week ${week}`,
        stage: "league" as const,
      })),
    ],
  },
];

export const OUR_TEAMS: Array<{
  key: TeamKey;
  nseSlug: string;
  tier: Tier;
  tournament: string;
  /** Snapshot of the team's own match list (has the playoff rows the week pages lack). */
  matchesPage: string;
  roster: Array<{ nickname: string; role: RosterRole; profile: string }>;
}> = [
  {
    key: "champions",
    nseSlug: "city-champions",
    tier: "div2",
    tournament: "rocket-league-nse-spring-26-division-2",
    matchesPage: "teams_city-champions_matches",
    roster: [
      { nickname: "Caprillix", role: "leader", profile: "c2769bf2f699459aaf6311cb44bbb238" },
      { nickname: "Yams", role: "player", profile: "be116d3bfd79467a895bc605f2a2a769" },
      { nickname: "kid", role: "player", profile: "f0ef8914693b4a77a088e103eca4643c" },
      { nickname: "Matte", role: "player", profile: "75e3717985b2474cb37c7baaba58bdf9" },
      { nickname: "Wasil Barits", role: "player", profile: "eaed4b1afe824eeb811b2c359a4cf1c5" },
    ],
  },
  {
    key: "commanders",
    nseSlug: "city-commanders",
    tier: "swiss",
    tournament: "rocket-league-nse-spring-26",
    matchesPage: "teams_city-commanders_matches",
    roster: [
      { nickname: "Caprillix", role: "leader", profile: "c2769bf2f699459aaf6311cb44bbb238" },
      { nickname: "Robin Ghigea", role: "player", profile: "0504608d6c774148bb56ed3cce3416f9" },
      { nickname: "Nizar Omar", role: "player", profile: "a0a59f322a88441ca3975b73e3c83495" },
      { nickname: "Ardi Halili", role: "player", profile: "1d60ec6428f9493da330a81ae4d73372" },
    ],
  },
];

/**
 * Sheet names that differ from NSE team names (after normalising case/whitespace).
 * Key: sheet name, value: NSE name.
 */
export const SHEET_ALIASES: Record<string, string> = {};
