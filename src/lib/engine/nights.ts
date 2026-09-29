/**
 * Per-night view for any team: its rounds with labels, and its points for the night.
 *
 * City teams' points come from the engine when the tier has a ladder (so the site can show why),
 * falling back to the NSE sheet. Other teams' points come from the sheet, which is the official
 * record, falling back to the engine. When both exist and disagree, `mismatch` is set.
 */
import type { ExternalNightResult, Night, Tier } from "@/lib/domain/types";
import { chronological, fromSide, type Ctx, type TeamSeries } from "./context";
import { nightPoints, roundLabel, type NightPoints, type RoundResult } from "./points";

export interface RoundView {
  ts: TeamSeries;
  round: number;
  /** 'Opener', 'Winners’ match', '1–1 decider', ... */
  label: string;
  /** 'Round 3 · 1–1 decider' */
  title: string;
  recordAfter: { w: number; l: number };
}

export interface TeamNight {
  night: Night;
  tier: Tier;
  rounds: RoundView[];
  computed: NightPoints | null;
  sheet: ExternalNightResult | null;
  points: number | null;
  pointsSource: "engine" | "sheet" | null;
  mismatch: boolean;
  /** '1–1, won decider' when the ladder applies, otherwise the night's record ('Won 2 of 3'). */
  path: string;
  promoted: boolean;
  relegated: boolean;
}

export function sheetCell(ctx: Ctx, nightId: string, teamId: string): ExternalNightResult | null {
  return ctx.ds.externalResults.find((r) => r.nightId === nightId && r.teamId === teamId) ?? null;
}

function recordText(w: number, n: number): string {
  return n === 0 ? "" : `Won ${w} of ${n}`;
}

/** Build the view of one night for one team. Returns null if the team has no series that night. */
export function teamNight(ctx: Ctx, night: Night, teamId: string): TeamNight | null {
  const series = (ctx.seriesByNight.get(night.id) ?? [])
    .filter((s) => s.homeTeamId === teamId || s.awayTeamId === teamId)
    .map((s) => fromSide(ctx, s, teamId))
    .sort(chronological);
  const sheet = sheetCell(ctx, night.id, teamId);
  if (!series.length && !sheet) return null;

  const ruleset = ctx.ruleset(night.tier);
  const rounds: RoundView[] = [];
  let w = 0;
  let l = 0;
  for (const ts of series) {
    const round = ts.series.round ?? rounds.length + 1;
    const label = roundLabel(round, { w, l }, ruleset.roundStyle, night.stage);
    if (ts.result === "L") l++;
    else w++;
    const title = label.startsWith("Round ") ? label : `Round ${round} · ${label}`;
    rounds.push({ ts, round, label, title, recordAfter: { w, l } });
  }

  const byRound = (n: number): RoundResult | null => {
    const r = rounds.find((x) => x.round === n);
    return r ? r.ts.result : null;
  };
  let computed: NightPoints | null = null;
  const [r1, r2, r3] = [byRound(1), byRound(2), byRound(3)];
  if (ruleset.ladder && night.stage === "league" && r1 && r2 && r3) {
    computed = nightPoints(r1, r2, r3, ruleset.ladder, {
      promotes: !!ruleset.promotesTo,
      relegates: !!ruleset.relegatesTo,
    });
  }

  // Ours: calculated (the site can explain it). Theirs: the official sheet value.
  const sheetPoints = sheet?.points ?? null;
  const preferEngine = !!ctx.team(teamId).ourKey;
  const points = preferEngine ? (computed?.points ?? sheetPoints) : (sheetPoints ?? computed?.points ?? null);
  const source: TeamNight["pointsSource"] =
    points === null ? null : preferEngine ? (computed ? "engine" : "sheet") : sheetPoints !== null ? "sheet" : "engine";
  const wins = rounds.filter((r) => r.ts.result !== "L").length;
  const promoMatch =
    night.stage === "league" && ruleset.roundStyle === "swiss" ? rounds.find((r) => r.round === 4) : undefined;
  let path = computed?.path ?? recordText(wins, rounds.length);
  if (!computed && promoMatch) path = `${promoMatch.ts.result === "W" ? "Won" : "Lost"} promotion match`;

  return {
    night,
    tier: night.tier,
    rounds,
    computed,
    sheet,
    points,
    pointsSource: source,
    mismatch: !!computed && sheetPoints !== null && computed.points !== sheetPoints,
    path,
    promoted: computed?.promoted ?? (sheet?.status === "promoted_out" || promoMatch?.ts.result === "W"),
    relegated: computed?.relegated ?? sheet?.status === "relegated_out",
  };
}

/** All nights (in order) that belong to a City team's season. */
export function nightsForSeason(ctx: Ctx, teamId: string, trackedTier: Tier): TeamNight[] {
  return ctx.ds.nights
    .filter((n) => n.seasonId === ctx.ds.season.id)
    .filter((n) => n.stage === "league" || n.tier === trackedTier)
    .map((n) => teamNight(ctx, n, teamId))
    .filter((x): x is TeamNight => !!x && x.rounds.length > 0)
    .sort((a, b) => a.night.week - b.night.week);
}
