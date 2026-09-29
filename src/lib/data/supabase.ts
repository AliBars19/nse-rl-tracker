import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Dataset,
  ExternalNightResult,
  ExternalStanding,
  Game,
  Night,
  Player,
  PlayerGameStat,
  RosterEntry,
  Season,
  Series,
  Team,
  TeamSeason,
  UpcomingNight,
} from "@/lib/domain/types";

type Row = Record<string, unknown>;

/** snake_case row -> camelCase object (shallow). */
export function camel<T>(row: Row): T {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v;
  return out as T;
}

const PAGE = 1000; // PostgREST's default max rows per request

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function all(build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: unknown }>): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(`Supabase query failed: ${JSON.stringify(error)}`);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) return rows;
  }
}

function strip<T>(rows: Row[], drop: string[]): T[] {
  return rows.map((r) => {
    const copy = { ...r };
    for (const d of drop) delete copy[d];
    return camel<T>(copy);
  });
}

export async function listSeasonsFromDb(db: SupabaseClient): Promise<Season[]> {
  const rows = await all((a, b) => db.from("seasons").select("*").order("slug").range(a, b));
  return rows.map((r) => camel<Season>(r));
}

export async function loadDatasetFromDb(db: SupabaseClient, seasonSlug: string): Promise<Dataset | null> {
  const seasons = await listSeasonsFromDb(db);
  const season = seasons.find((s) => s.slug === seasonSlug);
  if (!season) return null;
  const sid = season.id;

  const [
    teams,
    teamSeasons,
    nights,
    series,
    externalResults,
    externalStandings,
    players,
    roster,
    games,
    playerGameStats,
    upcoming,
  ] = await Promise.all([
    all((a, b) => db.from("teams").select("*").order("name").range(a, b)),
    all((a, b) => db.from("team_seasons").select("*").eq("season_id", sid).range(a, b)),
    all((a, b) => db.from("nights").select("*").eq("season_id", sid).order("week").range(a, b)),
    all((a, b) => db.from("series").select("*").eq("season_id", sid).order("nse_match_id").range(a, b)),
    all((a, b) =>
      db.from("external_night_results").select("*, nights!inner(season_id)").eq("nights.season_id", sid).range(a, b),
    ),
    all((a, b) => db.from("external_standings").select("*").eq("season_id", sid).range(a, b)),
    all((a, b) => db.from("players").select("*").order("nickname").range(a, b)),
    all((a, b) => db.from("roster_entries").select("*").eq("season_id", sid).range(a, b)),
    all((a, b) =>
      db
        .from("games")
        .select("id, series_id, game_number, ballchasing_id, home_goals, away_goals, overtime, processed_at, series!inner(season_id)")
        .eq("series.season_id", sid)
        .range(a, b),
    ),
    all((a, b) =>
      db
        .from("player_game_stats")
        .select(
          "game_id, player_id, team_id, display_name, score, goals, assists, saves, shots, mvp, games!inner(series!inner(season_id))",
        )
        .eq("games.series.season_id", sid)
        .range(a, b),
    ),
    all((a, b) => db.from("upcoming_nights").select("*").eq("season_id", sid).range(a, b)),
  ]);

  return {
    season,
    seasons,
    teams: strip<Team>(teams, []),
    teamSeasons: strip<TeamSeason>(teamSeasons, []),
    nights: strip<Night>(nights, []),
    series: strip<Series>(series, []),
    externalResults: strip<ExternalNightResult>(externalResults, ["nights"]),
    externalStandings: strip<ExternalStanding>(externalStandings, []),
    players: strip<Player>(players, []),
    roster: strip<RosterEntry>(roster, []),
    games: strip<Game>(games, ["series"]),
    playerGameStats: strip<PlayerGameStat>(playerGameStats, ["games"]),
    upcoming: strip<UpcomingNight>(upcoming, []),
  };
}
