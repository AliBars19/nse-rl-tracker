import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getReplay } from "./client";
import { detectColour, mapReplay, type Colour, type RosterPlayer } from "./map";

async function rosterFor(db: SupabaseClient, teamId: string | null, seasonId: string): Promise<RosterPlayer[]> {
  if (!teamId) return [];
  const { data } = await db
    .from("roster_entries")
    .select("players(id, nickname, platform_ids)")
    .eq("team_id", teamId)
    .eq("season_id", seasonId);
  return (data ?? []).flatMap((r) => {
    const p = r.players as unknown as { id: string; nickname: string; platform_ids: Record<string, string> | null } | null;
    return p ? [{ id: p.id, nickname: p.nickname, platformIds: p.platform_ids }] : [];
  });
}

export interface ProcessResult {
  status: "pending" | "ok" | "failed";
  message: string;
  unmatched?: string[];
}

/**
 * Poll one uploaded game. When ballchasing has parsed it, write goals + per-player stats
 * and keep the full JSON in games.raw.
 */
export async function processGame(db: SupabaseClient, gameId: string): Promise<ProcessResult> {
  const { data: game, error } = await db
    .from("games")
    .select("id, ballchasing_id, home_colour, series:series_id(id, season_id, home_team_id, away_team_id, home_score, away_score)")
    .eq("id", gameId)
    .single();
  if (error || !game) throw new Error("Game not found");
  if (!game.ballchasing_id) throw new Error("Game has no ballchasing id");
  const series = game.series as unknown as {
    id: string;
    season_id: string;
    home_team_id: string;
    away_team_id: string | null;
  };

  const replay = await getReplay(game.ballchasing_id);
  if (replay.status === "pending") return { status: "pending", message: "ballchasing is still processing the replay" };
  if (replay.status === "failed") {
    await db.from("games").update({ ballchasing_status: "failed" }).eq("id", gameId);
    return { status: "failed", message: "ballchasing could not parse this replay" };
  }

  const homeRoster = await rosterFor(db, series.home_team_id, series.season_id);
  const awayRoster = await rosterFor(db, series.away_team_id, series.season_id);
  let homeColour = game.home_colour as Colour | null;
  if (!homeColour) {
    const homeDetected = detectColour(replay, homeRoster);
    const awayDetected = detectColour(replay, awayRoster);
    homeColour = homeDetected ?? (awayDetected ? (awayDetected === "blue" ? "orange" : "blue") : null);
  }
  if (!homeColour) {
    await db.from("games").update({ ballchasing_status: "ok", raw: replay }).eq("id", gameId);
    return {
      status: "failed",
      message: "Could not tell which colour City played (no roster names matched). Re-upload with the colour set.",
    };
  }

  const mapped = mapReplay(replay, homeColour, homeRoster, awayRoster);
  const { error: e1 } = await db
    .from("games")
    .update({
      ballchasing_status: "ok",
      home_colour: homeColour,
      home_goals: mapped.homeGoals,
      away_goals: mapped.awayGoals,
      overtime: mapped.overtime,
      raw: replay,
      processed_at: new Date().toISOString(),
    })
    .eq("id", gameId);
  if (e1) throw e1;

  await db.from("player_game_stats").delete().eq("game_id", gameId);
  const rows = mapped.stats.map((s) => ({
    game_id: gameId,
    player_id: s.playerId,
    team_id: s.side === "home" ? series.home_team_id : series.away_team_id,
    display_name: s.displayName,
    platform: s.platform,
    platform_id: s.platformId,
    score: s.score,
    goals: s.goals,
    assists: s.assists,
    saves: s.saves,
    shots: s.shots,
    mvp: s.mvp,
    extra: s.extra,
  }));
  if (rows.length) {
    const { error: e2 } = await db.from("player_game_stats").insert(rows);
    if (e2) throw e2;
  }
  // Rosters exist only for City teams, so "a side with a roster" = one of ours.
  const ours = (side: "home" | "away") => (side === "home" ? homeRoster : awayRoster).length > 0;
  const unmatched = mapped.stats.filter((s) => ours(s.side) && !s.playerId).map((s) => s.displayName);
  return {
    status: "ok",
    message: `${mapped.homeGoals}–${mapped.awayGoals}${mapped.overtime ? " (OT)" : ""}`,
    unmatched,
  };
}
