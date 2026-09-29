/**
 * Domain types shared by the data layer, the engines and the UI.
 *
 * These mirror the Postgres schema in `supabase/migrations` (see docs/data-model.md),
 * but use camelCase and plain strings for ids. Everything the site shows is derived
 * from a `Dataset` by pure functions in `src/lib/engine`.
 */

export type Tier = "div1" | "div2" | "swiss";

/** `placement` = Swiss Stage 1, `league` = weekly nights, `playoff` = end-of-season bracket. */
export type Stage = "placement" | "league" | "playoff";

/** The two City teams. Used in URLs: /spring-26/champions, /spring-26/commanders. */
export type TeamKey = "champions" | "commanders";

export type PlayoffRound = "last32" | "last16" | "qf" | "sf" | "final";

export interface Season {
  id: string;
  slug: string; // 'spring-26'
  name: string; // 'NSE Spring 26'
  shortName: string; // 'Spring 26'
  isCurrent: boolean;
  /** League and playoffs are over: copy says "Finished 6th" instead of "Currently 6th". */
  isFinished: boolean;
}

export interface Team {
  id: string;
  slug: string; // URL-safe, unique: 'royal-bears-rocket-league'
  name: string; // 'Royal Bears Rocket league'
  shortName: string; // 'Royal Bears'
  nseSlug: string | null; // NSE team slug, e.g. 'royal-bears--rocket-league-'
  ourKey: TeamKey | null; // set only for City teams
}

/** A City team's entry in one season: which tier's table it is tracked in, and how it finished. */
export interface TeamSeason {
  seasonId: string;
  teamId: string;
  tier: Tier;
  nseTournamentSlug: string | null;
}

/**
 * One scoring unit for a tier: a weekly league night, or Swiss Stage 1
 * (which ran over two evenings but was scored once).
 */
export interface Night {
  id: string;
  seasonId: string;
  tier: Tier;
  stage: Exclude<Stage, "playoff">;
  /** Sort order and the week number shown in the standings. Stage 1 uses 1. */
  week: number;
  label: string; // 'Week 3' | 'Stage 1'
  date: string; // ISO date of the (first) evening, 'YYYY-MM-DD'
  venue: string | null; // 'Beckwith Park Night'
}

/**
 * One best-of-N series. Stored neutrally (home/away) so every team's path can be
 * reconstructed, not just ours. `awayTeamId = null` means a bye for the home team.
 */
export interface Series {
  id: string;
  seasonId: string;
  tier: Tier;
  nseMatchId: number | null;
  stage: Stage;
  nightId: string | null; // league/placement only
  round: number | null; // 1..3 (1..6 in Stage 1, 4 = Swiss promotion match)
  playoffRound: PlayoffRound | null;
  homeTeamId: string;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  bestOf: number;
  isForfeit: boolean;
  playedAt: string | null; // ISO timestamp
}

/** Status of a team in one tier's sheet column for one night. */
export type NightStatus =
  | "played"
  | "promoted_in"
  | "relegated_in"
  | "promoted_out"
  | "relegated_out"
  | "absent";

/** A cell from the NSE standings sheet: points and/or a movement status. */
export interface ExternalNightResult {
  nightId: string;
  teamId: string;
  points: number | null;
  status: NightStatus;
}

/** A row of the NSE standings sheet for one tier (position, total, playoff note). */
export interface ExternalStanding {
  seasonId: string;
  tier: Tier;
  teamId: string;
  position: number | null; // null = no longer in this tier
  total: number | null;
  playoffNote: string | null; // 'Bye Round 1 and 2'
}

export interface Player {
  id: string;
  slug: string;
  nickname: string;
  nseProfileUrl: string | null;
  platformIds: Record<string, string> | null;
}

export type RosterRole = "leader" | "player" | "sub";

export interface RosterEntry {
  teamId: string;
  seasonId: string;
  playerId: string;
  role: RosterRole;
}

export interface Game {
  id: string;
  seriesId: string;
  gameNumber: number;
  ballchasingId: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  overtime: boolean | null;
  processedAt: string | null;
}

export interface PlayerGameStat {
  gameId: string;
  playerId: string | null; // null when the name is not linked to a player yet
  teamId: string | null;
  displayName: string;
  score: number | null;
  goals: number | null;
  assists: number | null;
  saves: number | null;
  shots: number | null;
  mvp: boolean | null;
}

/** Admin-entered info about the next night, used by the Scenarios engine. */
export interface UpcomingNight {
  seasonId: string;
  teamId: string;
  tier: Tier;
  week: number;
  date: string | null;
  r1OpponentId: string | null; // null = TBC
}

/** Everything the public site needs for one season, loaded in one go (it is small). */
export interface Dataset {
  season: Season;
  seasons: Season[];
  teams: Team[];
  teamSeasons: TeamSeason[];
  nights: Night[];
  series: Series[];
  externalResults: ExternalNightResult[];
  externalStandings: ExternalStanding[];
  players: Player[];
  roster: RosterEntry[];
  games: Game[];
  playerGameStats: PlayerGameStat[];
  upcoming: UpcomingNight[];
}
