/**
 * Convert parsed NSE match rows into neutral Series records. Shared by the seed builder
 * and the admin "Import from NSE" action so both apply the same rules:
 *  - "Points" / "Promotion Match and Points" rows against a Bye are admin records: skipped
 *  - a real opponent in "Promotion Match..." is a Swiss promotion match (round 4)
 *  - Bye in a round (e.g. Week 3 Round 3) is stored with no opponent
 *  - 1–0 in a best-of-5+ is a forfeit
 */
import type { Series, Stage, Tier } from "@/lib/domain/types";
import { classifyNseRound, looksLikeForfeit, nseKickoffToIso, type NseMatchRow, type NseTeamRef } from "./nse";

export const isBye = (ref: NseTeamRef) => !ref.slug && /^bye$/i.test(ref.name);

export interface RowContext {
  seasonId: string;
  tier: Tier;
  night: { id: string; stage: Exclude<Stage, "playoff"> } | null;
  teamId: (ref: NseTeamRef) => string;
  seriesId: (nseMatchId: number) => string;
}

export type RowResult = { series: Series } | { skip: string };

export function rowToSeries(row: NseMatchRow, c: RowContext): RowResult {
  const kind = classifyNseRound(row.round);
  const homeBye = isBye(row.home);
  const awayBye = isBye(row.away);
  if ((kind.kind === "points" || kind.kind === "promotion") && (homeBye || awayBye)) return { skip: "admin points row" };
  if (kind.kind === "unknown") return { skip: `unknown round "${row.round}"` };
  if (homeBye && awayBye) return { skip: "bye vs bye" };
  if (kind.kind !== "playoff" && !c.night) return { skip: "league row without a night" };

  const stage: Stage = kind.kind === "playoff" ? "playoff" : c.night!.stage;
  const round = kind.kind === "round" ? kind.round : kind.kind === "promotion" ? 4 : null;
  const bye = homeBye || awayBye;
  const homeRef = homeBye ? row.away : row.home;
  const [homeScore, awayScore] = homeBye ? [row.awayScore, row.homeScore] : [row.homeScore, row.awayScore];
  const bestOf = Math.max(5, Math.max(homeScore ?? 0, awayScore ?? 0) * 2 - 1);

  return {
    series: {
      id: c.seriesId(row.id),
      seasonId: c.seasonId,
      tier: c.tier,
      nseMatchId: row.id,
      stage,
      nightId: stage === "playoff" ? null : c.night!.id,
      round,
      playoffRound: kind.kind === "playoff" ? kind.playoffRound : null,
      homeTeamId: c.teamId(homeRef),
      awayTeamId: bye ? null : c.teamId(row.away),
      homeScore: bye ? null : homeScore,
      awayScore: bye ? null : awayScore,
      bestOf,
      isForfeit: bye ? false : looksLikeForfeit(homeScore, awayScore, bestOf),
      playedAt: row.date && row.time ? nseKickoffToIso(row.date, row.time) : null,
    },
  };
}
