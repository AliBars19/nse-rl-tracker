/**
 * Opponent scouting: head-to-head records, meeting-by-meeting points effects,
 * the opponent's own season, and generated "pattern" sentences.
 */
import type { Team, Tier } from "@/lib/domain/types";
import { type Ctx, type TeamSeries } from "./context";
import { nightsForSeason, teamNight, type RoundView, type TeamNight } from "./nights";
import { TIER_NAMES, type Bracket, type Ruleset } from "./rulesets";
import { standingsTable } from "./standings";
import { isDecider, ordinal, PLAYOFF_ROUND_NAMES } from "./stats";

// ------------------------------------------------------------------ opponent list

export interface OpponentSummary {
  team: Team;
  meetings: TeamSeries[];
  w: number;
  l: number;
  forfeits: number;
  inPlayoffs: boolean;
  /** '2 meetings · 1 forfeit' */
  meta: string;
}

export function opponentList(series: TeamSeries[]): OpponentSummary[] {
  const byOpp = new Map<string, TeamSeries[]>();
  for (const s of series) {
    if (!s.opponent) continue;
    byOpp.set(s.opponent.id, [...(byOpp.get(s.opponent.id) ?? []), s]);
  }
  const firstSeen = (list: TeamSeries[]) => series.indexOf(list[0]);
  return [...byOpp.values()]
    .sort((a, b) => b.length - a.length || firstSeen(a) - firstSeen(b))
    .map((meetings) => {
      const forfeits = meetings.filter((m) => m.series.isForfeit).length;
      const inPlayoffs = meetings.some((m) => m.series.stage === "playoff");
      const meta = [
        `${meetings.length} meeting${meetings.length === 1 ? "" : "s"}`,
        forfeits ? `${forfeits} forfeit${forfeits === 1 ? "" : "s"}` : null,
        inPlayoffs ? "playoffs" : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return {
        team: meetings[0].opponent!,
        meetings,
        w: meetings.filter((m) => m.result === "W").length,
        l: meetings.filter((m) => m.result === "L").length,
        forfeits,
        inPlayoffs,
        meta,
      };
    });
}

// ------------------------------------------------------------------ meetings

export interface Meeting {
  ts: TeamSeries;
  /** 'WEEK 3 · 17 FEB' */
  when: string;
  /** 'Round 3 · 1–1 decider' */
  round: string;
  score: string;
  win: boolean;
  /** Points effect in plain words: 'Cost you 2 pts (6 → 4)'. */
  effect: string;
  /** URL segment for the match night: 'week-3' | 'stage-1' | 'playoffs' */
  nightSlug: string;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function nightSlugOf(ts: TeamSeries): string {
  if (ts.series.stage === "playoff" || !ts.night) return "playoffs";
  return ts.night.stage === "placement" ? "stage-1" : `week-${ts.night.week}`;
}

function r3Effect(bracket: Bracket, won: boolean, ruleset: Ruleset): string {
  const w = ruleset.ladder![`${bracket}:W`];
  const l = ruleset.ladder![`${bracket}:L`];
  if (won) return bracket === "2-0" && ruleset.promotesTo ? `Earned ${w} pts and promotion` : `Earned ${w} pts instead of ${l}`;
  return `Cost you ${w - l} pts (${w} → ${l})`;
}

function leagueEffect(rv: RoundView, tn: TeamNight, ruleset: Ruleset): string {
  const won = rv.ts.result !== "L";
  const before = { w: rv.recordAfter.w - (won ? 1 : 0), l: rv.recordAfter.l - (won ? 0 : 1) };
  if (tn.night.stage === "placement") return `Stage 1 · ${tn.points ?? "—"} pts for the stage`;
  if (ruleset.roundStyle === "bracket" && ruleset.ladder) {
    if (rv.round === 1) return won ? "Sent you to the winners’ match" : "Sent you to the losers’ match";
    if (rv.round === 2) {
      if (before.w === 1) return won ? "Put you in the promotion match" : "Dropped you into the 1–1 decider";
      return won ? "Lifted you into the 1–1 decider" : "Sent you to the relegation match";
    }
    if (rv.round === 3) {
      const bracket = (before.w === 2 ? "2-0" : before.l === 2 ? "0-2" : "1-1") as Bracket;
      return r3Effect(bracket, won, ruleset);
    }
  }
  return tn.points !== null ? `Part of a ${tn.points}-point night` : "Points not recorded";
}

function playoffEffect(ts: TeamSeries, all: TeamSeries[]): string {
  const round = ts.series.playoffRound ? PLAYOFF_ROUND_NAMES[ts.series.playoffRound] : "playoffs";
  if (ts.result === "L") return `Knocked you out in the ${round}`;
  const next = all[all.indexOf(ts) + 1];
  const nextRound = next?.series.playoffRound ? PLAYOFF_ROUND_NAMES[next.series.playoffRound] : null;
  if (ts.series.playoffRound === "final") return "Won the title";
  return nextRound ? `Sent you through to the ${nextRound}` : "Sent you through";
}

export function meetingsWith(ctx: Ctx, ourSeason: TeamSeries[], oppId: string): Meeting[] {
  const cache = new Map<string, TeamNight | null>();
  return ourSeason
    .filter((s) => s.opponent?.id === oppId)
    .map((ts) => {
      const score = `${ts.our}–${ts.opp}`;
      const win = ts.result === "W";
      let when: string;
      let round: string;
      let effect: string;
      if (ts.series.stage === "playoff" || !ts.night) {
        when = `PLAYOFFS · ${ts.series.playedAt ? shortDate(ts.series.playedAt) : ""}`.replace(/ · $/, "");
        round = ts.series.playoffRound ? PLAYOFF_ROUND_NAMES[ts.series.playoffRound] : "Playoffs";
        effect = playoffEffect(
          ts,
          ourSeason.filter((s) => s.series.stage === "playoff"),
        );
      } else {
        const night = ts.night;
        if (!cache.has(night.id)) cache.set(night.id, teamNight(ctx, night, ts.teamId));
        const tn = cache.get(night.id)!;
        const rv = tn.rounds.find((r) => r.ts.series.id === ts.series.id)!;
        when = `${night.label.toUpperCase()} · ${shortDate(night.date)}`;
        round = rv.title;
        effect = leagueEffect(rv, tn, ctx.ruleset(night.tier));
      }
      if (ts.series.isForfeit) effect += " · forfeit";
      return { ts, when, round, score, win, effect, nightSlug: nightSlugOf(ts) };
    });
}

// ------------------------------------------------------------------ head to head

export interface HeadToHead {
  series: { w: number; l: number };
  games: { w: number; l: number };
  forfeits: number;
  gamesPlayed: number;
}

export function headToHead(meetings: TeamSeries[]): HeadToHead {
  const real = meetings.filter((m) => !m.series.isForfeit && m.result !== "BYE");
  const games = {
    w: real.reduce((s, m) => s + (m.our ?? 0), 0),
    l: real.reduce((s, m) => s + (m.opp ?? 0), 0),
  };
  return {
    series: {
      w: meetings.filter((m) => m.result === "W").length,
      l: meetings.filter((m) => m.result === "L").length,
    },
    games,
    forfeits: meetings.filter((m) => m.series.isForfeit).length,
    gamesPlayed: games.w + games.l,
  };
}

// ------------------------------------------------------------------ their season

export interface TheirWeek {
  label: string; // 'WK 3'
  points: string; // '6' | '—'
  note: string; // '1–1, won decider'
}

export interface TheirSeason {
  /** 'Royal Bears Rocket league · Division 2 · Finished 8th, 18 pts' */
  line: string;
  weeks: TheirWeek[];
  summary: string;
}

const STATUS_NOTE: Record<string, string> = {
  promoted_in: "Promoted in",
  relegated_in: "Relegated in",
  promoted_out: "Promoted out",
  relegated_out: "Relegated out",
  absent: "Not in the division",
};

function playoffSentence(note: string | null): string {
  if (!note) return "";
  if (/1 and 2/.test(note)) return " Playoffs: byes in Rounds 1 and 2.";
  if (/bye round 1/i.test(note)) return " Playoffs: Round 1 bye.";
  return ` Playoffs: ${note}.`;
}

export function theirSeason(ctx: Ctx, oppId: string, ourTeamId: string, tier: Tier, finished: boolean): TheirSeason {
  const opp = ctx.team(oppId);
  const table = standingsTable(ctx, tier);
  const row = [...table.rows, ...table.departed].find((r) => r.team.id === oppId);
  const ours = table.rows.find((r) => r.team.id === ourTeamId);
  const tierName = TIER_NAMES[tier].long;
  const ruleset = ctx.ruleset(tier);

  const nights = ctx.ds.nights
    .filter((n) => n.seasonId === ctx.ds.season.id && n.tier === tier)
    .sort((a, b) => a.week - b.week);
  const weeks: TheirWeek[] = nights.map((n) => {
    const tn = teamNight(ctx, n, oppId);
    const cell = row?.cells[n.week];
    const label = n.stage === "placement" ? "STG 1" : `WK ${n.week}`;
    if (tn && tn.rounds.length && tn.points !== null) return { label, points: String(tn.points), note: tn.path };
    if (cell?.points != null) return { label, points: String(cell.points), note: "From the NSE sheet" };
    return { label, points: "—", note: STATUS_NOTE[cell?.status ?? "absent"] ?? "" };
  });

  let line = `${opp.name} · ${tierName}`;
  let summary = "";
  if (row?.position != null) {
    line += ` · ${finished ? "Finished" : "Currently"} ${ordinal(row.position)}, ${row.total} pts`;
    const level = table.rows.filter((r) => r.total === row.total && r.team.id !== oppId && r.team.id !== ourTeamId);
    const parts = [`Total ${row.total} pts`];
    const rel: string[] = [];
    if (level.length) rel.push(`level with ${level.map((r) => r.team.shortName).join(" and ")}`);
    if (ours) {
      const gap = row.total - ours.total;
      rel.push(gap === 0 ? "level with you" : gap > 0 ? `${gap} ahead of you` : `${-gap} behind you`);
    }
    summary = `${parts[0]}${rel.length ? `, ${rel.join(" and ")}` : ""}.${playoffSentence(row.playoffNote)}`;
  } else if (row) {
    const moved = Object.entries(row.cells).find(([, c]) => c.status === "promoted_out" || c.status === "relegated_out");
    if (moved) {
      const [week, c] = moved;
      const to = c.status === "promoted_out" ? ruleset.promotesTo : ruleset.relegatesTo;
      const verb = c.status === "promoted_out" ? "Promoted" : "Relegated";
      line += ` · ${verb}${to ? ` to ${TIER_NAMES[to].long}` : ""} in Week ${week}`;
      summary = `${verb} out of ${tierName} in Week ${week}, so they are not in the final table.`;
    }
  }
  return { line, weeks, summary };
}

// ------------------------------------------------------------------ patterns

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const word = (n: number) => WORDS[n] ?? String(n);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function r3LabelOf(tn: TeamNight): string | null {
  return tn.rounds.find((r) => r.round === 3)?.label ?? null;
}

export function patterns(
  ctx: Ctx,
  ourSeason: TeamSeries[],
  ourTier: Tier,
  oppId: string,
  allOpponents: OpponentSummary[],
): string[] {
  const out: string[] = [];
  const meetings = ourSeason.filter((s) => s.opponent?.id === oppId);
  if (!meetings.length) return out;
  const ruleset = ctx.ruleset(ourTier);
  const ourNights = nightsForSeason(ctx, ourSeason[0].teamId, ourTier).filter((n) => n.night.stage === "league");

  // 1. How often
  const metNights = new Set(meetings.filter((m) => m.night?.stage === "league").map((m) => m.night!.id));
  const maxMeetings = Math.max(...allOpponents.map((o) => o.meetings.length));
  const topCount = allOpponents.filter((o) => o.meetings.length === maxMeetings).length;
  if (meetings.length === 1) {
    const m = meetings[0];
    const verb = m.result === "W" ? "won" : "lost";
    if (m.series.stage === "playoff") {
      const round = m.series.playoffRound ? PLAYOFF_ROUND_NAMES[m.series.playoffRound] : "playoffs";
      out.push(`You met them once, in the playoffs: ${verb} the ${round} ${m.our}–${m.opp}.`);
    } else if (m.night) {
      const tn = teamNight(ctx, m.night, m.teamId)!;
      const rv = tn.rounds.find((r) => r.ts.series.id === m.series.id)!;
      out.push(`You met them once: ${m.night.label}, Round ${rv.round} (${rv.label}), ${verb} ${m.our}–${m.opp}.`);
    }
  } else if (metNights.size >= 2) {
    const most = meetings.length === maxMeetings ? (topCount === 1 ? ", the most of any opponent" : ", joint most of any opponent") : "";
    out.push(`You met them in ${metNights.size} of ${ourNights.length} league nights${most}.`);
  } else {
    out.push(`You met them ${word(meetings.length)} times.`);
  }

  // 2. Which rounds, and what they were worth
  if (ruleset.ladder && ruleset.roundStyle === "bracket" && meetings.length >= 2) {
    const r3 = meetings.filter((m) => m.series.round === 3 && m.night?.stage === "league");
    const byLabel = new Map<string, number>();
    for (const m of r3) {
      const tn = teamNight(ctx, m.night!, m.teamId)!;
      const label = r3LabelOf(tn)!;
      byLabel.set(label, (byLabel.get(label) ?? 0) + 1);
    }
    for (const [label, n] of byLabel) {
      if (n < 2) continue;
      const bracket: Bracket = label === "Promotion match" ? "2-0" : label === "Relegation match" ? "0-2" : "1-1";
      const w = ruleset.ladder[`${bracket}:W`];
      const l = ruleset.ladder[`${bracket}:L`];
      const plural = label === "1–1 decider" ? "1–1 deciders" : `${label.toLowerCase()}es`;
      out.push(
        `${cap(word(n))} of the ${word(meetings.length)} meetings were ${plural}: a direct ${w} vs ${l} points swing each time.`,
      );
    }
  }

  // 3. Where they usually land
  if (ruleset.roundStyle === "bracket") {
    const theirNights = ctx.ds.nights
      .filter((n) => n.seasonId === ctx.ds.season.id && n.tier === ourTier && n.stage === "league")
      .map((n) => teamNight(ctx, n, oppId))
      .filter((tn): tn is TeamNight => !!tn && tn.rounds.length >= 3);
    const counts = new Map<string, number>();
    for (const tn of theirNights) {
      const label = r3LabelOf(tn);
      if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const [label, k] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    const n = theirNights.length;
    if (label && n >= 2 && k === n) {
      out.push(`They reached the ${label} every single week, so that is where you are most likely to meet them.`);
    } else if (label && n >= 3 && k / n > 0.5) {
      out.push(`They reached the ${label} in ${k} of ${n} weeks, so that is where you are most likely to meet them.`);
    }
  }

  // 4. Close series
  const real = meetings.filter((m) => !m.series.isForfeit);
  const close = real.filter(isDecider);
  if (real.length >= 2 && close.length >= 2) {
    out.push(`${cap(word(close.length))} of ${word(real.length)} series against them went the full distance.`);
  }

  // 5. Forfeits
  const ff = meetings.filter((m) => m.series.isForfeit);
  if (ff.length) {
    out.push(
      ff.length === 1
        ? `One ${ff[0].result === "W" ? "win" : "loss"} was a forfeit (${ff[0].our}–${ff[0].opp}), so it is left out of the game count.`
        : `${cap(word(ff.length))} results were forfeits, so they are left out of the game count.`,
    );
  }
  return out;
}

export function finishedText(position: number | null, total: number, finished: boolean): string {
  if (position === null) return `${total} pts`;
  return `${finished ? "Finished" : "Currently"} ${ordinal(position)}, ${total} pts`;
}
