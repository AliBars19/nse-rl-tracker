/**
 * What the replay auto-sorter may place files on: each City team's series with a known score
 * (it matches wins and losses), plus scrims with a score entered. Built from a Dataset so the
 * Replays page and the "fetch from NSE" action hand the browser the same shape.
 */
import type { Dataset } from "@/lib/domain/types";
import { ctxOf, ourTeam, seasonSeries } from "@/lib/engine/context";
import { nightsForSeason } from "@/lib/engine/nights";
import { scrimScore, scrimSeries } from "@/lib/engine/scrims";
import { PLAYOFF_ROUND_NAMES } from "@/lib/engine/stats";
import { ukDateOf, type SortSeries, type SortTeam } from "@/lib/replay/sort";
import { dayDate } from "@/lib/view/dashboard";
import { TEAM_KEYS } from "@/lib/view/team";

export interface SorterSeries extends SortSeries {
  /** Game numbers that already have processed replay stats. */
  taken: number[];
}
export interface SorterTeam extends Omit<SortTeam, "series"> {
  name: string;
  series: SorterSeries[];
}

export function buildSorterTeams(ds: Dataset): SorterTeam[] {
  const ctx = ctxOf(ds);
  const takenIn = (seriesId: string) => ds.games.filter((g) => g.seriesId === seriesId && g.processedAt).map((g) => g.gameNumber);
  const teams: SorterTeam[] = [];
  for (const key of TEAM_KEYS) {
    const o = ourTeam(ds, key);
    if (!o) continue;
    const labels = new Map<string, string>();
    for (const n of nightsForSeason(ctx, o.team.id, o.teamSeason.tier)) for (const r of n.rounds) labels.set(r.ts.series.id, `${n.night.label} · ${r.title}`);
    const series: SorterSeries[] = [];
    for (const s of seasonSeries(ctx, o.team.id, o.teamSeason.tier)) {
      if (!s.opponent || s.series.isForfeit || s.our === null || s.opp === null) continue;
      const where = labels.get(s.series.id) ?? (s.series.playoffRound ? PLAYOFF_ROUND_NAMES[s.series.playoffRound] : "Playoffs");
      series.push({
        id: s.series.id,
        label: `${where} · vs ${s.opponent.shortName} ${s.our}–${s.opp}`,
        date: s.series.playedAt ? ukDateOf(s.series.playedAt) : (s.night?.date ?? null),
        round: s.series.round,
        ours: s.our,
        theirs: s.opp,
        taken: takenIn(s.series.id),
      });
    }
    for (const s of scrimSeries(ctx, o.team.id)) {
      const score = s.opponent ? scrimScore(ctx, s) : null;
      if (!s.opponent || score?.source !== "entered" || !s.series.playedAt) continue;
      series.push({
        id: s.series.id,
        label: `Scrim · ${dayDate(s.series.playedAt)} · vs ${s.opponent.shortName} ${score.our}–${score.opp}`,
        date: ukDateOf(s.series.playedAt),
        round: null,
        ours: score.our,
        theirs: score.opp,
        taken: takenIn(s.series.id),
      });
    }
    teams.push({
      key,
      name: o.team.name,
      rosterNames: ds.roster.filter((r) => r.teamId === o.team.id).map((r) => ds.players.find((p) => p.id === r.playerId)?.nickname ?? ""),
      series,
    });
  }
  return teams;
}
