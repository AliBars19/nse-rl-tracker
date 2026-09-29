import "server-only";
import { replayCoverage } from "@/lib/engine/players";
import { headToHead, meetingsWith, opponentList, patterns, theirSeason } from "@/lib/engine/scouting";
import type { TeamPage } from "./team";

export function buildScouting(p: TeamPage, oppSlug: string | null) {
  const opponents = opponentList(p.season);
  const selected = oppSlug ? opponents.find((o) => o.team.slug === oppSlug) : opponents[0];
  if (!selected) return { opponents, selected: null } as const;

  const opp = selected.team;
  const h2h = headToHead(selected.meetings);
  const coverage = replayCoverage(p.ctx, selected.meetings);
  return {
    opponents,
    selected: {
      team: opp,
      h2h,
      meetings: meetingsWith(p.ctx, p.season, opp.id),
      their: theirSeason(p.ctx, opp.id, p.team.id, p.teamSeason.tier, p.ds.season.isFinished),
      patterns: patterns(p.ctx, p.season, p.teamSeason.tier, opp.id, opponents),
      coverage,
    },
  } as const;
}
