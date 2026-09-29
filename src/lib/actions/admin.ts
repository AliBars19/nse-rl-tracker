"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { adminDataset, ourTeamOrThrow, uniqueSlug } from "@/lib/data/admin";
import type { Dataset, Tier } from "@/lib/domain/types";
import { defaultShortName, nameKey } from "@/lib/import/names";
import { nseDateToIso, parseNseMatchTable, type NseTeamRef } from "@/lib/import/nse";
import { rowToSeries } from "@/lib/import/nse-series";
import { parseStandingsSheet, sheetCsvUrl, SPRING_26_LAYOUTS } from "@/lib/import/sheet";

export type ActionResult<T = unknown> = { ok: true; message: string; data?: T } | { ok: false; error: string };

const TeamKeyZ = z.enum(["champions", "commanders"]);
const TierZ = z.enum(["div1", "div2", "swiss"]);

function fail(e: unknown): { ok: false; error: string } {
  unstable_rethrow(e); // let redirects (e.g. session expired -> sign in) through
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

function refreshSite() {
  revalidatePath("/", "layout");
}

// ------------------------------------------------------------------ league night entry

const RoundZ = z
  .object({
    round: z.number().int().min(1).max(4),
    opponentId: z.string().uuid().nullable(),
    newOpponent: z.string().trim().max(80).nullable(),
    bye: z.boolean(),
    our: z.number().int().min(0).max(9).nullable(),
    opp: z.number().int().min(0).max(9).nullable(),
    forfeit: z.boolean(),
    nseMatchId: z.number().int().positive().nullable(),
  })
  .superRefine((r, ctx) => {
    if (r.bye) return;
    if (!r.opponentId && !r.newOpponent) ctx.addIssue({ code: "custom", message: `Round ${r.round}: pick an opponent` });
    if (r.our === null || r.opp === null) ctx.addIssue({ code: "custom", message: `Round ${r.round}: enter both scores` });
    else if (r.our === r.opp) ctx.addIssue({ code: "custom", message: `Round ${r.round}: a series cannot be a draw` });
  });

const NightZ = z.object({
  teamKey: TeamKeyZ,
  week: z.number().int().min(1).max(20),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date"),
  rounds: z.array(RoundZ).min(1).max(4),
});

export type NightInput = z.infer<typeof NightZ>;

export async function saveNight(input: NightInput): Promise<ActionResult> {
  try {
    const data = NightZ.parse(input);
    const { db, ds } = await adminDataset();
    if (!ds) throw new Error("No current season. Create one on the admin overview first.");
    const { team, teamSeason } = ourTeamOrThrow(ds, data.teamKey);

    // Night (one per season/tier/week)
    let night = ds.nights.find((n) => n.tier === teamSeason.tier && n.week === data.week);
    if (night) {
      const { error } = await db.from("nights").update({ date: data.date }).eq("id", night.id);
      if (error) throw error;
    } else {
      const { data: row, error } = await db
        .from("nights")
        .insert({ season_id: ds.season.id, tier: teamSeason.tier, stage: "league", week: data.week, label: `Week ${data.week}`, date: data.date })
        .select("id")
        .single();
      if (error) throw error;
      night = { id: row.id, seasonId: ds.season.id, tier: teamSeason.tier, stage: "league", week: data.week, label: `Week ${data.week}`, date: data.date, venue: null };
    }

    for (const r of data.rounds) {
      let opponentId = r.bye ? null : r.opponentId;
      if (!r.bye && !opponentId && r.newOpponent) opponentId = await findOrCreateTeam(db, ds, r.newOpponent);
      const bestOf = Math.max(5, Math.max(r.our ?? 0, r.opp ?? 0) * 2 - 1);
      const row = {
        season_id: ds.season.id,
        tier: teamSeason.tier,
        stage: "league",
        night_id: night.id,
        round: r.round,
        playoff_round: null,
        home_team_id: team.id,
        away_team_id: opponentId,
        home_score: r.bye ? null : r.our,
        away_score: r.bye ? null : r.opp,
        best_of: bestOf,
        is_forfeit: !r.bye && r.forfeit,
        played_at: null as string | null,
        nse_match_id: r.nseMatchId,
      };
      const existing = ds.series.find(
        (s) => s.nightId === night!.id && s.round === r.round && (s.homeTeamId === team.id || s.awayTeamId === team.id),
      );
      if (existing) {
        row.played_at = existing.playedAt;
        const { error } = await db.from("series").update(row).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("series").insert(row);
        if (error) throw error;
      }
    }
    refreshSite();
    return { ok: true, message: `Saved Week ${data.week} for ${team.name}.` };
  } catch (e) {
    return fail(e);
  }
}

async function findOrCreateTeam(db: Awaited<ReturnType<typeof adminDataset>>["db"], ds: Dataset, name: string): Promise<string> {
  const existing = ds.teams.find((t) => nameKey(t.name) === nameKey(name) || nameKey(t.shortName) === nameKey(name));
  if (existing) return existing.id;
  const { data, error } = await db
    .from("teams")
    .insert({ name, short_name: defaultShortName(name), slug: await uniqueSlug(db, "teams", name) })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// ------------------------------------------------------------------ upcoming night (Scenarios)

const UpcomingZ = z.object({
  teamKey: TeamKeyZ,
  week: z.number().int().min(1).max(20),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  r1OpponentId: z.string().uuid().nullable(),
});

export async function saveUpcoming(input: z.infer<typeof UpcomingZ>): Promise<ActionResult> {
  try {
    const data = UpcomingZ.parse(input);
    const { db, ds } = await adminDataset();
    if (!ds) throw new Error("No current season");
    const { team, teamSeason } = ourTeamOrThrow(ds, data.teamKey);
    const { error } = await db.from("upcoming_nights").upsert({
      season_id: ds.season.id,
      team_id: team.id,
      tier: teamSeason.tier,
      week: data.week,
      date: data.date,
      r1_opponent_id: data.r1OpponentId,
    });
    if (error) throw error;
    refreshSite();
    return { ok: true, message: `Week ${data.week} preview is live on the ${team.shortName} dashboard.` };
  } catch (e) {
    return fail(e);
  }
}

export async function clearUpcoming(teamKey: string): Promise<ActionResult> {
  try {
    const key = TeamKeyZ.parse(teamKey);
    const { db, ds } = await adminDataset();
    if (!ds) throw new Error("No current season");
    const { team } = ourTeamOrThrow(ds, key);
    const { error } = await db.from("upcoming_nights").delete().eq("season_id", ds.season.id).eq("team_id", team.id);
    if (error) throw error;
    refreshSite();
    return { ok: true, message: "Cleared. The dashboard shows the last night's preview again." };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------------ roster + players

const AddPlayerZ = z.object({
  teamKey: TeamKeyZ,
  nickname: z.string().trim().min(1).max(60),
  role: z.enum(["leader", "player", "sub"]),
  nseProfileUrl: z.string().trim().url().or(z.literal("")).nullable(),
});

export async function addRosterPlayer(input: z.infer<typeof AddPlayerZ>): Promise<ActionResult> {
  try {
    const data = AddPlayerZ.parse(input);
    const { db, ds } = await adminDataset();
    if (!ds) throw new Error("No current season");
    const { team } = ourTeamOrThrow(ds, data.teamKey);
    let player = ds.players.find(
      (p) => nameKey(p.nickname) === nameKey(data.nickname) || (data.nseProfileUrl && p.nseProfileUrl === data.nseProfileUrl),
    );
    if (!player) {
      const { data: row, error } = await db
        .from("players")
        .insert({ nickname: data.nickname, slug: await uniqueSlug(db, "players", data.nickname), nse_profile_url: data.nseProfileUrl || null })
        .select("id")
        .single();
      if (error) throw error;
      player = { id: row.id, slug: "", nickname: data.nickname, nseProfileUrl: null, platformIds: null };
    }
    const { error } = await db
      .from("roster_entries")
      .upsert({ team_id: team.id, season_id: ds.season.id, player_id: player.id, role: data.role });
    if (error) throw error;
    refreshSite();
    return { ok: true, message: `${data.nickname} is on the ${team.shortName} roster.` };
  } catch (e) {
    return fail(e);
  }
}

export async function removeRosterPlayer(teamKey: string, playerId: string): Promise<ActionResult> {
  try {
    const key = TeamKeyZ.parse(teamKey);
    const id = z.string().uuid().parse(playerId);
    const { db, ds } = await adminDataset();
    if (!ds) throw new Error("No current season");
    const { team } = ourTeamOrThrow(ds, key);
    const { error } = await db
      .from("roster_entries")
      .delete()
      .eq("team_id", team.id)
      .eq("season_id", ds.season.id)
      .eq("player_id", id);
    if (error) throw error;
    refreshSite();
    return { ok: true, message: "Removed from the roster (their stats are kept)." };
  } catch (e) {
    return fail(e);
  }
}

const PlatformIdsZ = z.object({
  playerId: z.string().uuid(),
  /** 'steam:7656…, epic:abc' */
  text: z.string().max(500),
});

export async function savePlatformIds(input: z.infer<typeof PlatformIdsZ>): Promise<ActionResult> {
  try {
    const data = PlatformIdsZ.parse(input);
    const ids: Record<string, string> = {};
    for (const part of data.text.split(/[,\n]/)) {
      const m = part.trim().match(/^([a-z]+)\s*:\s*(\S+)$/i);
      if (m) ids[m[1].toLowerCase()] = m[2];
      else if (part.trim()) throw new Error(`"${part.trim()}" should look like platform:id (e.g. steam:76561198…)`);
    }
    const { db } = await adminDataset();
    const { error } = await db.from("players").update({ platform_ids: Object.keys(ids).length ? ids : null }).eq("id", data.playerId);
    if (error) throw error;
    refreshSite();
    return { ok: true, message: "Platform IDs saved. New replays will match this player automatically." };
  } catch (e) {
    return fail(e);
  }
}

const LinkZ = z.object({
  gameIds: z.array(z.string().uuid()).min(1),
  displayName: z.string().min(1),
  playerId: z.string().uuid(),
  remember: z.boolean(),
});

/** Link a replay name to a roster player (every game it appears in), optionally remembering the platform id. */
export async function linkReplayName(input: z.infer<typeof LinkZ>): Promise<ActionResult> {
  try {
    const data = LinkZ.parse(input);
    const { db } = await adminDataset();
    const { data: rows, error } = await db
      .from("player_game_stats")
      .update({ player_id: data.playerId })
      .in("game_id", data.gameIds)
      .eq("display_name", data.displayName)
      .select("platform, platform_id");
    if (error) throw error;
    if (data.remember) {
      const withId = (rows ?? []).find((r) => r.platform && r.platform_id);
      if (withId) {
        const { data: p } = await db.from("players").select("platform_ids").eq("id", data.playerId).single();
        const ids = { ...((p?.platform_ids as Record<string, string>) ?? {}), [withId.platform as string]: withId.platform_id as string };
        await db.from("players").update({ platform_ids: ids }).eq("id", data.playerId);
      }
    }
    refreshSite();
    return { ok: true, message: `Linked “${data.displayName}”.` };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------------ standings sheet import

export interface SheetDiffRow {
  team: string;
  teamStatus: "matched" | "new";
  position: string; // '6' or '6 → 5'
  total: string;
  changes: string[];
  warnings: string[];
}

export interface SheetPreview {
  tier: Tier;
  rows: SheetDiffRow[];
  unchanged: number;
  missingWeeks: number[];
  csv: string;
}

async function loadCsv(tier: Tier, pasted: string | null): Promise<string> {
  if (pasted?.trim()) return pasted;
  const res = await fetch(sheetCsvUrl(tier), { cache: "no-store", redirect: "follow" });
  if (!res.ok) throw new Error(`Could not download the sheet (${res.status}). Paste the CSV instead.`);
  return res.text();
}

function matchTeam(ds: Dataset, name: string) {
  const key = nameKey(name);
  const compact = key.replace(/ /g, "");
  return (
    ds.teams.find((t) => nameKey(t.name) === key) ??
    ds.teams.find((t) => t.nseSlug?.replace(/[^a-z0-9]/g, "") === compact) ??
    null
  );
}

export async function previewSheet(input: { tier: string; csv: string | null }): Promise<ActionResult<SheetPreview>> {
  try {
    const tier = TierZ.parse(input.tier);
    const { ds } = await adminDataset();
    if (!ds) throw new Error("No current season");
    const csv = await loadCsv(tier, input.csv);
    const parsed = parseStandingsSheet(csv, SPRING_26_LAYOUTS[tier]);
    if (!parsed.length) throw new Error("No team rows found. Is that the right tab?");
    const nights = ds.nights.filter((n) => n.tier === tier);
    const missingWeeks = SPRING_26_LAYOUTS[tier].weeks.map(([w]) => w).filter((w) => !nights.some((n) => n.week === w));
    let unchanged = 0;
    const rows: SheetDiffRow[] = [];
    for (const r of parsed) {
      const team = matchTeam(ds, r.team);
      const st = team ? ds.externalStandings.find((s) => s.teamId === team.id && s.tier === tier) : undefined;
      const changes: string[] = [];
      for (const c of r.cells) {
        const night = nights.find((n) => n.week === c.week);
        if (!night) continue;
        const old = team ? ds.externalResults.find((x) => x.nightId === night.id && x.teamId === team.id) : undefined;
        const oldText = old ? (old.points ?? old.status) : "—";
        const newText = c.points ?? (c.status === "absent" ? "—" : c.status);
        if (String(oldText) !== String(newText)) changes.push(`${night.label}: ${oldText} → ${newText}`);
      }
      const pos = st?.position === r.position ? String(r.position ?? "—") : `${st?.position ?? "—"} → ${r.position ?? "—"}`;
      const total = st?.total === r.total ? String(r.total ?? "—") : `${st?.total ?? "—"} → ${r.total ?? "—"}`;
      if (!changes.length && team && pos.indexOf("→") < 0 && total.indexOf("→") < 0 && !r.warnings.length) {
        unchanged++;
        continue;
      }
      rows.push({ team: r.team, teamStatus: team ? "matched" : "new", position: pos, total, changes, warnings: r.warnings });
    }
    return {
      ok: true,
      message: `${parsed.length} rows read; ${rows.length} with changes, ${unchanged} unchanged.`,
      data: { tier, rows, unchanged, missingWeeks, csv },
    };
  } catch (e) {
    return fail(e);
  }
}

export async function applySheet(input: { tier: string; csv: string }): Promise<ActionResult> {
  try {
    const tier = TierZ.parse(input.tier);
    const { db, ds } = await adminDataset();
    if (!ds) throw new Error("No current season");
    const parsed = parseStandingsSheet(input.csv, SPRING_26_LAYOUTS[tier]);
    const nights = ds.nights.filter((n) => n.tier === tier);
    const results: Array<Record<string, unknown>> = [];
    const standings: Array<Record<string, unknown>> = [];
    let created = 0;
    for (const r of parsed) {
      let team = matchTeam(ds, r.team);
      if (!team) {
        const id = await findOrCreateTeam(db, ds, r.team);
        created++;
        team = { id, slug: "", name: r.team, shortName: r.team, nseSlug: null, ourKey: null };
        ds.teams.push(team);
      }
      standings.push({ season_id: ds.season.id, tier, team_id: team.id, position: r.position, total: r.total, playoff_note: r.playoffNote });
      for (const c of r.cells) {
        const night = nights.find((n) => n.week === c.week);
        if (!night) continue;
        results.push({ night_id: night.id, team_id: team.id, points: c.points, status: c.status });
      }
    }
    // Replace this tier's sheet data wholesale so removed rows disappear too.
    const { error: delSt } = await db.from("external_standings").delete().eq("season_id", ds.season.id).eq("tier", tier);
    if (delSt) throw delSt;
    if (nights.length) {
      const { error: delRes } = await db.from("external_night_results").delete().in("night_id", nights.map((n) => n.id));
      if (delRes) throw delRes;
    }
    if (standings.length) {
      const { error } = await db.from("external_standings").insert(standings);
      if (error) throw error;
    }
    for (let i = 0; i < results.length; i += 500) {
      const { error } = await db.from("external_night_results").insert(results.slice(i, i + 500));
      if (error) throw error;
    }
    refreshSite();
    return { ok: true, message: `Imported ${standings.length} rows and ${results.length} weekly cells${created ? `, created ${created} new teams` : ""}.` };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------------ NSE match import

const NseZ = z.object({
  tier: TierZ,
  tournament: z.string().regex(/^[a-z0-9-]+$/, "Tournament slug, e.g. rocket-league-nse-spring-26-division-2"),
  page: z.string().regex(/^(week-\d+|stage-1|teams\/[a-z0-9-]+\/matches)$/, "Page: week-N, stage-1 or teams/<slug>/matches"),
  week: z.number().int().min(1).max(20),
});

export interface NsePreview {
  rows: number;
  series: number;
  skipped: number;
  newTeams: string[];
  ours: string[];
  date: string | null;
}

async function fetchNse(tournament: string, page: string) {
  const url = `https://tournaments.nse.gg/tournaments/${tournament}/${page}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`NSE returned ${res.status} for ${url}`);
  const rows = parseNseMatchTable(await res.text());
  if (!rows.length) throw new Error("No match rows found on that page (is it rendered with JavaScript?)");
  return rows;
}

export async function previewNse(input: z.infer<typeof NseZ>): Promise<ActionResult<NsePreview>> {
  try {
    const data = NseZ.parse(input);
    const { ds } = await adminDataset();
    if (!ds) throw new Error("No current season");
    const rows = await fetchNse(data.tournament, data.page);
    const known = (ref: NseTeamRef) =>
      ds.teams.some((t) => (ref.slug && t.nseSlug === ref.slug) || nameKey(t.name) === nameKey(ref.name));
    const newTeams = new Set<string>();
    const ourIds = new Set(ds.teams.filter((t) => t.ourKey).map((t) => t.nseSlug));
    let series = 0;
    let skipped = 0;
    const ours: string[] = [];
    for (const row of rows) {
      const r = rowToSeries(row, {
        seasonId: ds.season.id,
        tier: data.tier,
        night: { id: "preview", stage: data.page === "stage-1" ? "placement" : "league" },
        teamId: (ref) => {
          if (!known(ref)) newTeams.add(ref.name);
          return ref.slug ?? ref.name;
        },
        seriesId: (id) => String(id),
      });
      if ("skip" in r) skipped++;
      else {
        series++;
        if (ourIds.has(row.home.slug) || ourIds.has(row.away.slug)) {
          ours.push(`${row.round}: ${row.home.name} ${row.homeScore}–${row.awayScore} ${row.away.name}`);
        }
      }
    }
    const date = rows[0]?.date ? nseDateToIso(rows[0].date) : null;
    return {
      ok: true,
      message: `${rows.length} rows on NSE: ${series} series to import, ${skipped} admin rows skipped.`,
      data: { rows: rows.length, series, skipped, newTeams: [...newTeams], ours, date },
    };
  } catch (e) {
    return fail(e);
  }
}

export async function applyNse(input: z.infer<typeof NseZ>): Promise<ActionResult> {
  try {
    const data = NseZ.parse(input);
    const { db, ds } = await adminDataset();
    if (!ds) throw new Error("No current season");
    const rows = await fetchNse(data.tournament, data.page);
    const isTeamPage = data.page.startsWith("teams/");
    const stage = data.page === "stage-1" ? "placement" : "league";

    // Night
    let night = ds.nights.find((n) => n.tier === data.tier && n.week === data.week) ?? null;
    if (!night && !isTeamPage) {
      const dates = rows.map((r) => nseDateToIso(r.date)).sort();
      const label = stage === "placement" ? "Stage 1" : `Week ${data.week}`;
      const { data: row, error } = await db
        .from("nights")
        .insert({ season_id: ds.season.id, tier: data.tier, stage, week: data.week, label, date: dates[0], venue: rows[0]?.venue ?? null })
        .select("*")
        .single();
      if (error) throw error;
      night = { id: row.id, seasonId: ds.season.id, tier: data.tier, stage, week: data.week, label, date: dates[0], venue: row.venue };
    }

    // Teams
    const teamIds = new Map<string, string>();
    const resolve = async (ref: NseTeamRef) => {
      const key = ref.slug ?? `name:${nameKey(ref.name)}`;
      if (teamIds.has(key)) return;
      const t = ds.teams.find((x) => (ref.slug && x.nseSlug === ref.slug) || nameKey(x.name) === nameKey(ref.name));
      if (t) {
        teamIds.set(key, t.id);
        return;
      }
      const { data: row, error } = await db
        .from("teams")
        .insert({ name: ref.name, short_name: defaultShortName(ref.name), slug: await uniqueSlug(db, "teams", ref.name), nse_slug: ref.slug })
        .select("id")
        .single();
      if (error) throw error;
      teamIds.set(key, row.id);
    };
    for (const r of rows) {
      for (const ref of [r.home, r.away]) if (!(/^bye$/i.test(ref.name) && !ref.slug)) await resolve(ref);
    }

    // Series (upsert on nse_match_id)
    const payload = rows
      .filter((r) => !isTeamPage || /last|quarter|semi|final/i.test(r.round))
      .map((row) =>
        rowToSeries(row, {
          seasonId: ds.season.id,
          tier: data.tier,
          night: night ? { id: night.id, stage: night.stage } : null,
          teamId: (ref) => teamIds.get(ref.slug ?? `name:${nameKey(ref.name)}`)!,
          seriesId: (id) => ds.series.find((s) => s.nseMatchId === id)?.id ?? crypto.randomUUID(),
        }),
      )
      .flatMap((r) => ("series" in r ? [r.series] : []))
      .map((s) => ({
        id: s.id,
        season_id: s.seasonId,
        tier: s.tier,
        nse_match_id: s.nseMatchId,
        stage: s.stage,
        night_id: s.nightId,
        round: s.round,
        playoff_round: s.playoffRound,
        home_team_id: s.homeTeamId,
        away_team_id: s.awayTeamId,
        home_score: s.homeScore,
        away_score: s.awayScore,
        best_of: s.bestOf,
        is_forfeit: s.isForfeit,
        played_at: s.playedAt,
      }));
    const { error } = await db.from("series").upsert(payload, { onConflict: "nse_match_id" });
    if (error) throw error;
    refreshSite();
    return { ok: true, message: `Imported ${payload.length} series${night ? ` into ${night.label}` : ""}.` };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------------ seasons

const SeasonZ = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(3),
  shortName: z.string().trim().min(2),
  makeCurrent: z.boolean(),
  champions: z.object({ tier: TierZ, tournament: z.string().trim() }),
  commanders: z.object({ tier: TierZ, tournament: z.string().trim() }),
});

export async function createSeason(input: z.infer<typeof SeasonZ>): Promise<ActionResult> {
  try {
    const data = SeasonZ.parse(input);
    const { db, ds } = await adminDataset();
    if (data.makeCurrent) {
      const { error } = await db.from("seasons").update({ is_current: false }).eq("is_current", true);
      if (error) throw error;
    }
    const { data: season, error } = await db
      .from("seasons")
      .insert({ slug: data.slug, name: data.name, short_name: data.shortName, is_current: data.makeCurrent, is_finished: false })
      .select("id")
      .single();
    if (error) throw error;
    const teams = ds?.teams ?? (await db.from("teams").select("id, our_key")).data?.map((t) => ({ id: t.id, ourKey: t.our_key })) ?? [];
    for (const key of ["champions", "commanders"] as const) {
      const team = teams.find((t) => t.ourKey === key);
      if (!team) continue;
      const cfg = data[key];
      const { error: e2 } = await db
        .from("team_seasons")
        .insert({ season_id: season.id, team_id: team.id, tier: cfg.tier, nse_tournament_slug: cfg.tournament || null });
      if (e2) throw e2;
      // Carry the roster over; edit it on the Roster page.
      if (ds) {
        const carry = ds.roster.filter((r) => r.teamId === team.id).map((r) => ({ team_id: team.id, season_id: season.id, player_id: r.playerId, role: r.role }));
        if (carry.length) await db.from("roster_entries").insert(carry);
      }
    }
    refreshSite();
    return { ok: true, message: `${data.name} created${data.makeCurrent ? " and set as current" : ""}.` };
  } catch (e) {
    return fail(e);
  }
}

export async function setSeasonFinished(input: { seasonId: string; finished: boolean }): Promise<ActionResult> {
  try {
    const { db } = await adminDataset();
    const { error } = await db.from("seasons").update({ is_finished: input.finished }).eq("id", z.string().uuid().parse(input.seasonId));
    if (error) throw error;
    refreshSite();
    return { ok: true, message: input.finished ? "Marked as finished." : "Marked as in progress." };
  } catch (e) {
    return fail(e);
  }
}
