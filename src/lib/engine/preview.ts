/**
 * Chooses which night the Scenarios section previews:
 *  - an upcoming night entered by the admin (live preview), or
 *  - between seasons, the team's last league night, rebuilt from the table as it stood
 *    going in (clearly labelled as archived).
 */
import type { Tier } from "@/lib/domain/types";
import type { Ctx } from "./context";
import { teamNight } from "./nights";
import { buildScenarios, type Scenarios, type ScenarioTeam } from "./scenarios";
import { standingsTable } from "./standings";

export interface ScenarioPreview {
  week: number;
  weekLabel: string; // 'WEEK 6'
  archived: boolean;
  r1Opponent: string | null;
  scenarios: Scenarios;
}

export function scenarioPreview(ctx: Ctx, teamId: string, tier: Tier): ScenarioPreview | null {
  const ruleset = ctx.ruleset(tier);
  if (!ruleset.ladder) return null;
  const table = standingsTable(ctx, tier);
  if (!table.rows.length) return null;

  const upcoming = ctx.ds.upcoming.find((u) => u.teamId === teamId && u.seasonId === ctx.ds.season.id);
  if (upcoming && upcoming.tier === tier) {
    const rows: ScenarioTeam[] = table.rows.map((r) => ({ teamId: r.team.id, name: r.team.shortName, total: r.total }));
    const r1 = ctx.teamOrNull(upcoming.r1OpponentId);
    const scenarios = buildScenarios({ ruleset, table: rows, ourTeamId: teamId, r1Opponent: r1?.shortName ?? null });
    return scenarios
      ? { week: upcoming.week, weekLabel: `WEEK ${upcoming.week}`, archived: false, r1Opponent: r1?.shortName ?? null, scenarios }
      : null;
  }

  // Archived: the last league night of this tier that the team played.
  const last = ctx.ds.nights
    .filter((n) => n.seasonId === ctx.ds.season.id && n.tier === tier && n.stage === "league")
    .sort((a, b) => b.week - a.week)
    .map((n) => teamNight(ctx, n, teamId))
    .find((tn) => tn && tn.rounds.length);
  if (!last) return null;

  const rows: ScenarioTeam[] = table.rows.map((r) => ({
    teamId: r.team.id,
    name: r.team.shortName,
    total: r.total - (r.cells[last.night.week]?.points ?? 0),
  }));
  const r1Opponent = last.rounds.find((r) => r.round === 1)?.ts.opponent?.shortName ?? null;
  const scenarios = buildScenarios({ ruleset, table: rows, ourTeamId: teamId, r1Opponent });
  return scenarios
    ? { week: last.night.week, weekLabel: `WEEK ${last.night.week}`, archived: true, r1Opponent, scenarios }
    : null;
}
