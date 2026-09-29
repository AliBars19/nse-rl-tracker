/**
 * Indexed view over a Dataset plus "from one team's point of view" helpers.
 * Everything here is pure; results are memoised per Dataset object.
 */
import type { Dataset, Night, Series, Team, TeamKey, TeamSeason, Tier } from "@/lib/domain/types";
import { getRuleset, type Ruleset } from "./rulesets";

export interface Ctx {
  ds: Dataset;
  team: (id: string) => Team;
  teamOrNull: (id: string | null) => Team | null;
  night: (id: string) => Night;
  seriesByTeam: Map<string, Series[]>;
  seriesByNight: Map<string, Series[]>;
  ruleset: (tier: Tier) => Ruleset;
}

const cache = new WeakMap<Dataset, Ctx>();

export function ctxOf(ds: Dataset): Ctx {
  const hit = cache.get(ds);
  if (hit) return hit;
  const teams = new Map(ds.teams.map((t) => [t.id, t]));
  const nights = new Map(ds.nights.map((n) => [n.id, n]));
  const seriesByTeam = new Map<string, Series[]>();
  const seriesByNight = new Map<string, Series[]>();
  const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => {
    const list = m.get(k);
    if (list) list.push(v);
    else m.set(k, [v]);
  };
  for (const s of ds.series) {
    push(seriesByTeam, s.homeTeamId, s);
    if (s.awayTeamId) push(seriesByTeam, s.awayTeamId, s);
    if (s.nightId) push(seriesByNight, s.nightId, s);
  }
  const ctx: Ctx = {
    ds,
    team: (id) => {
      const t = teams.get(id);
      if (!t) throw new Error(`Unknown team ${id}`);
      return t;
    },
    teamOrNull: (id) => (id ? (teams.get(id) ?? null) : null),
    night: (id) => {
      const n = nights.get(id);
      if (!n) throw new Error(`Unknown night ${id}`);
      return n;
    },
    seriesByTeam,
    seriesByNight,
    ruleset: (tier) => getRuleset(ds.season.slug, tier),
  };
  cache.set(ds, ctx);
  return ctx;
}

export type SeriesResult = "W" | "L" | "BYE";

/** A series seen from one team's side. */
export interface TeamSeries {
  series: Series;
  teamId: string;
  opponent: Team | null; // null = bye
  our: number | null;
  opp: number | null;
  result: SeriesResult;
  night: Night | null;
}

export function fromSide(ctx: Ctx, s: Series, teamId: string): TeamSeries {
  const home = s.homeTeamId === teamId;
  if (!home && s.awayTeamId !== teamId) throw new Error(`Team ${teamId} not in series ${s.id}`);
  const opponent = ctx.teamOrNull(home ? s.awayTeamId : s.homeTeamId);
  const our = home ? s.homeScore : s.awayScore;
  const opp = home ? s.awayScore : s.homeScore;
  const result: SeriesResult = !opponent ? "BYE" : (our ?? 0) > (opp ?? 0) ? "W" : "L";
  return { series: s, teamId, opponent, our, opp, result, night: s.nightId ? ctx.night(s.nightId) : null };
}

/** Chronological order: by night week, then round; playoffs last, by kick-off. */
export function chronological(a: TeamSeries, b: TeamSeries): number {
  const stageRank = (x: TeamSeries) => (x.series.stage === "playoff" ? 1 : 0);
  return (
    stageRank(a) - stageRank(b) ||
    (a.night?.week ?? 0) - (b.night?.week ?? 0) ||
    (a.series.round ?? 0) - (b.series.round ?? 0) ||
    (a.series.playedAt ?? "").localeCompare(b.series.playedAt ?? "")
  );
}

export function ourTeam(ds: Dataset, key: TeamKey): { team: Team; teamSeason: TeamSeason } | null {
  const team = ds.teams.find((t) => t.ourKey === key);
  if (!team) return null;
  const teamSeason = ds.teamSeasons.find((ts) => ts.teamId === team.id && ts.seasonId === ds.season.id);
  if (!teamSeason) return null;
  return { team, teamSeason };
}

/**
 * The series that make up a City team's season on this site: every league night it played,
 * Stage 1 only if Stage 1 belongs to the tier it is tracked in, plus its playoff series.
 * (Champions also played Swiss Stage 1 before Division 2; that is not part of their Div 2 season.)
 */
export function seasonSeries(ctx: Ctx, teamId: string, trackedTier: Tier): TeamSeries[] {
  return (ctx.seriesByTeam.get(teamId) ?? [])
    .filter((s) => {
      if (s.seasonId !== ctx.ds.season.id) return false;
      if (s.stage === "playoff") return s.tier === trackedTier;
      if (s.stage === "placement") return s.tier === trackedTier;
      return true;
    })
    .map((s) => fromSide(ctx, s, teamId))
    .sort(chronological);
}
