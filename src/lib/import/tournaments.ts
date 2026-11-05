/**
 * Which NSE tournament each division plays in, per season. A season is spread over up to three
 * tournaments (Division 1, Division 2 and the Swiss, which also holds Stage 1), and a City team can
 * move between them from one week to the next, so the replay sorter has to look in all of them.
 * Data, not code paths: add a season by adding an entry.
 */
import type { Tier } from "@/lib/domain/types";

export const NSE_TOURNAMENTS: Record<string, Partial<Record<Tier, string>>> = {
  "winter-26": {
    swiss: "rocket-league-nse-winter-26",
    div1: "rocket-league-nse-winter-26---division-1",
    div2: "rocket-league-nse-winter-26---division-2",
  },
  "spring-26": {
    swiss: "rocket-league-nse-spring-26",
    div1: "rocket-league-nse-spring-26-division-1",
    div2: "rocket-league-nse-spring-26-division-2",
  },
};

/** League weeks run 3 to 6; Stage 1 (the qualification nights) sits on the Swiss tournament only. */
export const LEAGUE_WEEK_PAGES = ["week-3", "week-4", "week-5", "week-6"] as const;

export interface NightPageTarget {
  tier: Tier;
  tournament: string;
  page: string;
  week: number;
}

/** Every NSE page that could hold a night of a season, in the order they are played. */
export function nightPageTargets(seasonSlug: string, extra: Array<{ tier: Tier; tournament: string }> = []): NightPageTarget[] {
  const tournaments = new Map<string, Tier>();
  for (const [tier, tournament] of Object.entries(NSE_TOURNAMENTS[seasonSlug] ?? {}) as Array<[Tier, string]>) tournaments.set(tournament, tier);
  // A tournament a City team is already recorded in (seasons not listed above).
  for (const e of extra) if (!tournaments.has(e.tournament)) tournaments.set(e.tournament, e.tier);

  const out: NightPageTarget[] = [];
  for (const [tournament, tier] of tournaments) {
    if (tier === "swiss") out.push({ tier, tournament, page: "stage-1", week: 1 });
  }
  for (const page of LEAGUE_WEEK_PAGES) {
    for (const [tournament, tier] of tournaments) out.push({ tier, tournament, page, week: Number(page.slice(5)) });
  }
  return out;
}

/**
 * Which tier a City team should be tracked in after an import of one week's page: the tier it just played
 * in, unless it has already played a later week somewhere else (re-importing an old week must not move it back).
 */
export function tierAfterImport(importedWeek: number, latestWeekPlayed: number): boolean {
  return importedWeek >= latestWeekPlayed;
}
