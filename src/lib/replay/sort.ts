/**
 * Sorts a pile of replay files into series and game numbers, using only what is inside them
 * plus the series we already know (from the NSE import).
 *
 *  1. Order the replays by the time each match started.
 *  2. Work out which side was City: roster names if any match, otherwise the side whose
 *     players keep turning up across the batch (opponents change between series).
 *  3. For each day, find the run of consecutive replays that adds up to each series' score
 *     (a 3–1 series is four games: three won, one lost). Series with no replays are skipped.
 *
 * Pure and tested: see sort.test.ts. The Replays admin page shows the result for review before
 * anything is uploaded.
 */

import { looseName } from "./names";

export type Colour = "blue" | "orange";

export interface SortReplay {
  id: string;
  /** Unix seconds. */
  startedAt: number;
  team0Score: number;
  team1Score: number;
  /** Lobby / saved name, e.g. 'NSEMD1G2'. Optional hint. */
  replayName: string;
  players: Array<{ name: string; team: 0 | 1 }>;
}

export interface SortSeries {
  id: string;
  label: string;
  /** UK calendar day, 'YYYY-MM-DD'. null = unknown (offered on every day). */
  date: string | null;
  round: number | null;
  /** Games City won / lost in this series (from the NSE score). */
  ours: number;
  theirs: number;
}

export interface SortTeam {
  key: string;
  /** Roster nicknames, matched case-insensitively against in-game names. */
  rosterNames: string[];
  series: SortSeries[];
}

export interface Placement {
  replayId: string;
  colour: Colour | null;
  /** Did City win this game? null when we could not tell which side was City. */
  won: boolean | null;
  seriesId: string | null;
  gameNumber: number | null;
  /** Placed from the lobby round alone because no series score fitted: worth a second look. */
  guess?: boolean;
}

export interface SortResult {
  teamKey: string;
  /** In match order, one per input replay. */
  placements: Placement[];
  /** Replays placed on a series because the results add up. */
  matched: number;
  /** Replays placed from their lobby round only (see Placement.guess). */
  guessed: number;
  /** Replays in which a roster name identified City's side. */
  rosterHits: number;
}

/** NSE lobbies are named 'NSEMD<match day>G<round>': returns the round, else null. */
export function lobbyRound(name: string): number | null {
  const m = /^NSEMD\d+G(\d+)$/i.exec(name.trim());
  return m ? Number(m[1]) : null;
}

const norm = (s: string) => s.trim().toLowerCase();
const ukDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" });
const dayOf = (startedAt: number) => ukDay.format(new Date(startedAt * 1000));

/** UK calendar day of an ISO timestamp, 'YYYY-MM-DD'. */
export const ukDateOf = (iso: string) => ukDay.format(new Date(iso));

/** Which colour was City in each replay (null = unknown), and in how many a roster name decided it. */
function ourColours(replays: SortReplay[], rosterNames: string[]): { colours: Array<Colour | null>; rosterHits: number } {
  const onRoster = (name: string) => rosterNames.some((r) => looseName(name, r));
  const seen = new Map<string, number>();
  for (const r of replays) for (const n of new Set(r.players.map((p) => norm(p.name)))) seen.set(n, (seen.get(n) ?? 0) + 1);
  let rosterHits = 0;
  const colours = replays.map((r) => {
    const count = (team: 0 | 1, weight: (name: string) => number) => r.players.filter((p) => p.team === team).reduce((s, p) => s + weight(norm(p.name)), 0);
    const byRoster = [(n: string) => (onRoster(n) ? 1 : 0), (n: string) => (seen.get(n) ?? 1) - 1];
    for (const [i, weight] of byRoster.entries()) {
      const blue = count(0, weight);
      const orange = count(1, weight);
      if (blue === orange) continue;
      if (i === 0) rosterHits++;
      return blue > orange ? ("blue" as const) : ("orange" as const);
    }
    return null;
  });
  return { colours, rosterHits };
}

interface Block {
  series: number;
  start: number;
  len: number;
}

/**
 * Best way to lay `series` (in order) over the time-ordered `won` results, each series taking
 * a consecutive run whose wins and losses equal its score. Replays and whole series may be
 * left out. Prefers more replays placed, then agreement with the lobby round.
 */
function fit(results: boolean[], hints: Array<number | null>, series: SortSeries[]): Block[] {
  const n = results.length;
  const m = series.length;
  const wins = [0]; // wins[i] = wins among results[0..i)
  for (const w of results) wins.push(wins[wins.length - 1] + (w ? 1 : 0));

  type Step = { score: number; move: "dropReplay" | "skipSeries" | Block | "end" };
  const memo = new Map<number, Step>();
  const solve = (i: number, j: number): Step => {
    if (i >= n || j >= m) return { score: 0, move: "end" };
    const key = i * m + j;
    const hit = memo.get(key);
    if (hit) return hit;
    let best: Step = { score: solve(i + 1, j).score, move: "dropReplay" };
    const skip = solve(i, j + 1).score;
    if (skip > best.score) best = { score: skip, move: "skipSeries" };
    const s = series[j];
    const len = s.ours + s.theirs;
    if (len > 0 && i + len <= n && wins[i + len] - wins[i] === s.ours) {
      let agree = 0;
      for (let k = i; k < i + len; k++) if (s.round !== null && hints[k] === s.round) agree++;
      const score = len * 100 + agree + solve(i + len, j + 1).score;
      // On a tie, place the earlier replays rather than leaving them out.
      if (score >= best.score) best = { score, move: { series: j, start: i, len } };
    }
    memo.set(key, best);
    return best;
  };

  const blocks: Block[] = [];
  let i = 0;
  let j = 0;
  for (;;) {
    const { move } = solve(i, j);
    if (move === "end") break;
    if (move === "dropReplay") i += 1;
    else if (move === "skipSeries") j += 1;
    else {
      blocks.push(move);
      i += move.len;
      j = move.series + 1;
    }
  }
  return blocks;
}

export function sortReplays(input: SortReplay[], team: SortTeam): SortResult {
  const replays = [...input].sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id));
  const { colours, rosterHits } = ourColours(replays, team.rosterNames);
  const won = replays.map((r, i) => {
    if (!colours[i] || r.team0Score === r.team1Score) return null;
    const ours = colours[i] === "blue" ? r.team0Score : r.team1Score;
    const theirs = colours[i] === "blue" ? r.team1Score : r.team0Score;
    return ours > theirs;
  });
  const placements: Placement[] = replays.map((r, i) => ({ replayId: r.id, colour: colours[i], won: won[i], seriesId: null, gameNumber: null }));

  // One day at a time: a pile may span several nights.
  const days = new Map<string, number[]>();
  replays.forEach((r, i) => days.set(dayOf(r.startedAt), [...(days.get(dayOf(r.startedAt)) ?? []), i]));
  for (const [day, idx] of days) {
    // A replay we cannot call won/lost breaks a run, so fit each stretch of known results.
    const stretches: number[][] = [[]];
    for (const i of idx) {
      if (won[i] === null) stretches.push([]);
      else stretches[stretches.length - 1].push(i);
    }
    const candidates = team.series.filter((s) => s.date === day || s.date === null);
    for (const stretch of stretches) {
      if (!stretch.length) continue;
      const blocks = fit(
        stretch.map((i) => won[i] === true),
        stretch.map((i) => lobbyRound(replays[i].replayName)),
        candidates,
      );
      for (const b of blocks) {
        for (let k = 0; k < b.len; k++) {
          const p = placements[stretch[b.start + k]];
          p.seriesId = candidates[b.series].id;
          p.gameNumber = k + 1;
        }
      }
    }

    // Whatever the scores could not place (a series with only some of its games saved, say):
    // use the lobby round, if exactly one series that day is that round. Marked as a guess.
    const used = new Map<string, Set<number>>();
    for (const i of idx) if (placements[i].seriesId) used.set(placements[i].seriesId!, (used.get(placements[i].seriesId!) ?? new Set()).add(placements[i].gameNumber!));
    for (const i of idx) {
      const p = placements[i];
      const round = lobbyRound(replays[i].replayName);
      if (p.seriesId || round === null) continue;
      const options = candidates.filter((c) => c.round === round);
      if (options.length !== 1) continue;
      const taken = used.get(options[0].id) ?? new Set<number>();
      let game = 1;
      while (taken.has(game)) game++;
      used.set(options[0].id, taken.add(game));
      Object.assign(p, { seriesId: options[0].id, gameNumber: game, guess: true });
    }
  }
  const guessed = placements.filter((p) => p.guess).length;
  return { teamKey: team.key, placements, matched: placements.filter((p) => p.seriesId).length - guessed, guessed, rosterHits };
}

/**
 * Both City teams play on the same nights, so decide whose replays these are. First choice: the
 * team whose series scores they add up to. If none do (partial uploads), the team whose roster
 * names appear in the replays. Null team when nothing separates them.
 */
export function sortForTeams(replays: SortReplay[], teams: SortTeam[]): { teamKey: string | null; result: SortResult | null; byTeam: SortResult[] } {
  const byTeam = teams.map((t) => sortReplays(replays, t));
  const pick = (score: (r: SortResult) => number) => {
    const top = Math.max(0, ...byTeam.map(score));
    const best = byTeam.filter((r) => score(r) === top);
    return top > 0 && best.length === 1 ? best[0] : null;
  };
  const best = pick((r) => r.matched) ?? pick((r) => r.guessed) ?? pick((r) => r.rosterHits);
  return { teamKey: best?.teamKey ?? null, result: best, byTeam };
}
