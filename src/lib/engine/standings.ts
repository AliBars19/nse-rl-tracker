/**
 * Standings tables, built from the imported NSE sheet (the official ordering).
 * Positions and totals are NSE's; we only reshape them. Ties keep NSE's order
 * because the tiebreak rules are not known yet.
 */
import type { NightStatus, Night, Team, Tier } from "@/lib/domain/types";
import type { Ctx } from "./context";
import { teamNight } from "./nights";

export interface StandingCell {
  points: number | null;
  status: NightStatus;
}

export interface StandingRow {
  team: Team;
  position: number | null;
  cells: Record<number, StandingCell>;
  total: number;
  playoffNote: string | null;
  isOurs: boolean;
}

export interface StandingsTable {
  tier: Tier;
  /** Week numbers with columns, in order (Swiss: 1 = Stage 1). */
  weeks: Array<{ week: number; label: string }>;
  /** Teams currently in the tier, in NSE's order. */
  rows: StandingRow[];
  /** Teams that were in the tier this season but left (promoted/relegated). */
  departed: StandingRow[];
  /**
   * True when there are no NSE sheet rows for this tier and the order is calculated here, with ties broken
   * by series wins and game difference (NSE's tiebreak rules are not known).
   */
  derived: boolean;
  /** Where the points come from: the standings sheet, NSE's own "Points" round for each week, or our ladder. */
  source: "sheet" | "nse" | "ladder";
}

export function standingsTable(ctx: Ctx, tier: Tier): StandingsTable {
  const { ds } = ctx;
  const nights = ds.nights.filter((n) => n.seasonId === ds.season.id && n.tier === tier).sort((a, b) => a.week - b.week);
  const nightWeek = new Map(nights.map((n) => [n.id, n.week]));
  const rows: StandingRow[] = [];
  for (const st of ds.externalStandings.filter((s) => s.seasonId === ds.season.id && s.tier === tier)) {
    const cells: Record<number, StandingCell> = {};
    for (const r of ds.externalResults) {
      const week = nightWeek.get(r.nightId);
      if (week === undefined || r.teamId !== st.teamId) continue;
      cells[week] = { points: r.points, status: r.status };
    }
    const summed = Object.values(cells).reduce((s, c) => s + (c.points ?? 0), 0);
    const team = ctx.team(st.teamId);
    rows.push({
      team,
      position: st.position,
      cells,
      total: st.total ?? summed,
      playoffNote: st.playoffNote,
      isOurs: !!team.ourKey,
    });
  }
  if (!rows.length) return derivedStandings(ctx, tier, nights);
  const current = rows.filter((r) => r.position !== null).sort((a, b) => a.position! - b.position!);
  const departed = rows.filter((r) => r.position === null);
  return {
    tier,
    weeks: nights.map((n) => ({ week: n.week, label: n.stage === "placement" ? "STG 1" : `WK ${n.week}` })),
    rows: current,
    departed,
    derived: false,
    source: "sheet",
  };
}

/**
 * A tier with no sheet rows (Winter 26): add up each team's weekly points. NSE publishes them in each week page's
 * "Points" round (stored as external night results); a team with no such cell gets the ladder's points when the tier
 * has one. Without either the table stays empty rather than guessing. The order is ours (points, then series wins,
 * then game difference), and a team that was promoted or demoted in the tier's latest night has left it.
 */
function derivedStandings(ctx: Ctx, tier: Tier, nights: Night[]): StandingsTable {
  const league = nights.filter((n) => n.stage === "league");
  const ladder = ctx.ruleset(tier).ladder;
  const published = league.some((n) => ctx.ds.externalResults.some((r) => r.nightId === n.id));
  const empty: StandingsTable = {
    tier,
    weeks: league.map((n) => ({ week: n.week, label: `WK ${n.week}` })),
    rows: [],
    departed: [],
    derived: true,
    source: published ? "nse" : "ladder",
  };
  if ((!ladder && !published) || !league.length) return empty;

  const teamIds = new Set<string>();
  for (const n of league) {
    for (const s of ctx.seriesByNight.get(n.id) ?? []) {
      teamIds.add(s.homeTeamId);
      if (s.awayTeamId) teamIds.add(s.awayTeamId);
    }
  }
  const lastWeek = Math.max(...league.map((n) => n.week));

  const built = [...teamIds].map((teamId) => {
    const cells: Record<number, StandingCell> = {};
    let total = 0;
    let seriesWins = 0;
    let gameDiff = 0;
    let left = false;
    for (const n of league) {
      const tn = teamNight(ctx, n, teamId);
      if (!tn) continue;
      const nse = tn.sheet;
      const points = nse ? nse.points : tn.computed ? tn.computed.points : null;
      const status: NightStatus = nse ? nse.status : "played";
      cells[n.week] = { points, status };
      total += points ?? 0;
      if (n.week === lastWeek && (status === "promoted_out" || status === "relegated_out")) left = true;
      for (const r of tn.rounds) {
        if (r.ts.result === "BYE") continue;
        if (r.ts.result === "W") seriesWins++;
        gameDiff += (r.ts.our ?? 0) - (r.ts.opp ?? 0);
      }
    }
    return { teamId, cells, total, seriesWins, gameDiff, left };
  });
  const order = (a: (typeof built)[number], b: (typeof built)[number]) =>
    b.total - a.total || b.seriesWins - a.seriesWins || b.gameDiff - a.gameDiff || ctx.team(a.teamId).name.localeCompare(ctx.team(b.teamId).name);
  const staying = built.filter((b) => !b.left).sort(order);
  const leaving = built.filter((b) => b.left).sort(order);

  const row = (b: (typeof built)[number], position: number | null): StandingRow => {
    const team = ctx.team(b.teamId);
    return { team, position, cells: b.cells, total: b.total, playoffNote: null, isOurs: !!team.ourKey };
  };
  return { ...empty, rows: staying.map((b, i) => row(b, i + 1)), departed: leaving.map((b) => row(b, null)) };
}

/** Text for one standings cell: points, or '—' when the team was not in the tier that week. */
export function cellText(c: StandingCell | undefined): string {
  if (!c || c.points === null) return "—";
  return String(c.points);
}

/** Rank with ties shared: [30, 30, 22] -> [1, 1, 3]. */
export function sharedRanks(totals: number[]): number[] {
  const sorted = [...totals].sort((a, b) => b - a);
  return totals.map((t) => sorted.indexOf(t) + 1);
}
