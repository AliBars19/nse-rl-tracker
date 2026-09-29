import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getDataset } from "@/lib/data";
import type { Dataset, Team, TeamKey, TeamSeason } from "@/lib/domain/types";
import { ctxOf, ourTeam, seasonSeries, type Ctx, type TeamSeries } from "@/lib/engine/context";
import { nightsForSeason, type TeamNight } from "@/lib/engine/nights";
import { TIER_NAMES, type Ruleset } from "@/lib/engine/rulesets";

export const TEAM_KEYS: TeamKey[] = ["champions", "commanders"];

export interface TeamOption {
  key: TeamKey;
  /** 'City Champions · Div 2' */
  label: string;
  /** 'CHAMPIONS · DIV 2' (phone) */
  short: string;
}

export interface TeamPage {
  ds: Dataset;
  ctx: Ctx;
  key: TeamKey;
  team: Team;
  teamSeason: TeamSeason;
  ruleset: Ruleset;
  tierName: string;
  season: TeamSeries[];
  nights: TeamNight[];
  teamOptions: TeamOption[];
  base: string; // '/spring-26/champions'
}

export function teamOptions(ds: Dataset): TeamOption[] {
  return TEAM_KEYS.flatMap((key) => {
    const o = ourTeam(ds, key);
    if (!o) return [];
    const tier = TIER_NAMES[o.teamSeason.tier].short;
    const word = o.team.name.replace(/^City\s+/i, "");
    return [{ key, label: `${o.team.name} · ${tier}`, short: `${word} · ${tier}`.toUpperCase() }];
  });
}

/** Everything a /[season]/[team]/... page needs. 404s for unknown seasons/teams. */
export const loadTeamPage = cache(async (seasonSlug: string, teamKey: string): Promise<TeamPage> => {
  if (!TEAM_KEYS.includes(teamKey as TeamKey)) notFound();
  const ds = await getDataset(seasonSlug);
  if (!ds) notFound();
  const o = ourTeam(ds, teamKey as TeamKey);
  if (!o) notFound();
  const ctx = ctxOf(ds);
  const tier = o.teamSeason.tier;
  return {
    ds,
    ctx,
    key: teamKey as TeamKey,
    team: o.team,
    teamSeason: o.teamSeason,
    ruleset: ctx.ruleset(tier),
    tierName: TIER_NAMES[tier].long,
    season: seasonSeries(ctx, o.team.id, tier),
    nights: nightsForSeason(ctx, o.team.id, tier),
    teamOptions: teamOptions(ds),
    base: `/${ds.season.slug}/${teamKey}`,
  };
});
