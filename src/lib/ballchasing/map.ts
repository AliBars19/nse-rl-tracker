/**
 * Pure mapping from a ballchasing replay (GET /api/replays/{id}) to our game + player stats.
 * Field names checked against https://ballchasing.com/doc/api (Sept 2026).
 */

export type Colour = "blue" | "orange";

export interface BcCore {
  score?: number;
  goals?: number;
  assists?: number;
  saves?: number;
  shots?: number;
  mvp?: boolean;
}

export interface BcPlayer {
  name: string;
  id?: { platform?: string; id?: string };
  stats?: { core?: BcCore; [k: string]: unknown };
}

export interface BcTeam {
  color?: Colour;
  name?: string;
  players?: BcPlayer[];
  stats?: { core?: BcCore };
}

export interface BcReplay {
  id: string;
  status: "ok" | "pending" | "failed";
  overtime?: boolean;
  duration?: number;
  date?: string;
  blue?: BcTeam;
  orange?: BcTeam;
}

export interface RosterPlayer {
  id: string;
  nickname: string;
  platformIds: Record<string, string> | null;
}

export interface MappedStat {
  side: "home" | "away";
  displayName: string;
  platform: string | null;
  platformId: string | null;
  playerId: string | null;
  score: number | null;
  goals: number | null;
  assists: number | null;
  saves: number | null;
  shots: number | null;
  mvp: boolean | null;
  extra: Record<string, unknown> | null;
}

export interface MappedGame {
  homeGoals: number;
  awayGoals: number;
  overtime: boolean;
  homeColour: Colour;
  stats: MappedStat[];
}

const norm = (s: string) => s.trim().toLowerCase();

/** Find a roster player for a replay player: platform id first, then exact nickname. */
export function matchPlayer(p: BcPlayer, roster: RosterPlayer[]): RosterPlayer | null {
  const platform = p.id?.platform;
  const pid = p.id?.id;
  if (platform && pid) {
    const byId = roster.find((r) => r.platformIds?.[platform] === pid);
    if (byId) return byId;
  }
  return roster.find((r) => norm(r.nickname) === norm(p.name)) ?? null;
}

/** Which colour our roster played as, by counting matched players. Null if it cannot tell. */
export function detectColour(replay: BcReplay, roster: RosterPlayer[]): Colour | null {
  const count = (t?: BcTeam) => (t?.players ?? []).filter((p) => matchPlayer(p, roster)).length;
  const blue = count(replay.blue);
  const orange = count(replay.orange);
  if (blue === orange) return null;
  return blue > orange ? "blue" : "orange";
}

function teamGoals(t?: BcTeam): number {
  if (typeof t?.stats?.core?.goals === "number") return t.stats.core.goals;
  return (t?.players ?? []).reduce((s, p) => s + (p.stats?.core?.goals ?? 0), 0);
}

/**
 * @param homeColour which colour the series' home team played as
 * @param homeRoster / awayRoster players we know for each side (for linking)
 */
export function mapReplay(
  replay: BcReplay,
  homeColour: Colour,
  homeRoster: RosterPlayer[],
  awayRoster: RosterPlayer[] = [],
): MappedGame {
  const home = homeColour === "blue" ? replay.blue : replay.orange;
  const away = homeColour === "blue" ? replay.orange : replay.blue;
  const stats: MappedStat[] = [];
  for (const [side, team, roster] of [
    ["home", home, homeRoster],
    ["away", away, awayRoster],
  ] as const) {
    for (const p of team?.players ?? []) {
      const core = p.stats?.core ?? {};
      const { core: _core, ...extra } = p.stats ?? {};
      void _core;
      stats.push({
        side,
        displayName: p.name,
        platform: p.id?.platform ?? null,
        platformId: p.id?.id ?? null,
        playerId: matchPlayer(p, roster)?.id ?? null,
        score: core.score ?? null,
        goals: core.goals ?? null,
        assists: core.assists ?? null,
        saves: core.saves ?? null,
        shots: core.shots ?? null,
        mvp: core.mvp ?? null,
        extra: Object.keys(extra).length ? extra : null,
      });
    }
  }
  return { homeGoals: teamGoals(home), awayGoals: teamGoals(away), overtime: !!replay.overtime, homeColour, stats };
}
