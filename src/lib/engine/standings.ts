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
   * True when there is no NSE sheet for this tier and the table is calculated from results with the
   * ruleset's ladder. Order and totals can then differ from NSE's own, and ties are broken by
   * series wins and game difference (NSE's tiebreak rules are not known).
   */
  derived: boolean;
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
  };
}

/**
 * A tier with no sheet rows (Winter 26 so far): add up each team's calculated league-night points.
 * Only possible when the tier has a ladder; otherwise the table stays empty rather than guessing.
 */
function derivedStandings(ctx: Ctx, tier: Tier, nights: Night[]): StandingsTable {
  const league = nights.filter((n) => n.stage === "league");
  const empty: StandingsTable = {
    tier,
    weeks: league.map((n) => ({ week: n.week, label: `WK ${n.week}` })),
    rows: [],
    departed: [],
    derived: true,
  };
  if (!ctx.ruleset(tier).ladder || !league.length) return empty;

  const teamIds = new Set<string>();
  for (const n of league) {
    for (const s of ctx.seriesByNight.get(n.id) ?? []) {
      teamIds.add(s.homeTeamId);
      if (s.awayTeamId) teamIds.add(s.awayTeamId);
    }
  }

  const built = [...teamIds].map((teamId) => {
    const cells: Record<number, StandingCell> = {};
    let total = 0;
    let seriesWins = 0;
    let gameDiff = 0;
    for (const n of league) {
      const tn = teamNight(ctx, n, teamId);
      if (!tn) continue;
      // Which teams actually move is NSE's call (two each way a week, from four 0–2 or 2–0 winners/losers): not guessed here.
      cells[n.week] = { points: tn.computed ? tn.computed.points : null, status: "played" as NightStatus };
      total += tn.computed?.points ?? 0;
      for (const r of tn.rounds) {
        if (r.ts.result === "BYE") continue;
        if (r.ts.result === "W") seriesWins++;
        gameDiff += (r.ts.our ?? 0) - (r.ts.opp ?? 0);
      }
    }
    return { teamId, cells, total, seriesWins, gameDiff };
  });
  built.sort((a, b) => b.total - a.total || b.seriesWins - a.seriesWins || b.gameDiff - a.gameDiff || ctx.team(a.teamId).name.localeCompare(ctx.team(b.teamId).name));

  const rows: StandingRow[] = built.map((b, i) => {
    const team = ctx.team(b.teamId);
    return { team, position: i + 1, cells: b.cells, total: b.total, playoffNote: null, isOurs: !!team.ourKey };
  });
  return { ...empty, rows };
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
