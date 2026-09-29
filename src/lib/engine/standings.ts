/**
 * Standings tables, built from the imported NSE sheet (the official ordering).
 * Positions and totals are NSE's; we only reshape them. Ties keep NSE's order
 * because the tiebreak rules are not known yet.
 */
import type { NightStatus, Team, Tier } from "@/lib/domain/types";
import type { Ctx } from "./context";

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
  const current = rows.filter((r) => r.position !== null).sort((a, b) => a.position! - b.position!);
  const departed = rows.filter((r) => r.position === null);
  return {
    tier,
    weeks: nights.map((n) => ({ week: n.week, label: n.stage === "placement" ? "STG 1" : `WK ${n.week}` })),
    rows: current,
    departed,
  };
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
