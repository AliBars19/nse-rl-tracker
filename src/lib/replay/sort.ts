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
}

export interface SortResult {
  teamKey: string;
  /** In match order, one per input replay. */
  placements: Placement[];
  /** How many replays were placed on a series. */
  matched: number;
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

/** Which colour was City in each replay (null = unknown). */
function ourColours(replays: SortReplay[], rosterNames: string[]): Array<Colour | null> {
  const roster = new Set(rosterNames.map(norm));
  const seen = new Map<string, number>();
  for (const r of replays) for (const n of new Set(r.players.map((p) => norm(p.name)))) seen.set(n, (seen.get(n) ?? 0) + 1);
  return replays.map((r) => {
    const count = (team: 0 | 1, weight: (name: string) => number) => r.players.filter((p) => p.team === team).reduce((s, p) => s + weight(norm(p.name)), 0);
    for (const weight of [(n: string) => (roster.has(n) ? 1 : 0), (n: string) => (seen.get(n) ?? 1) - 1]) {
      const blue = count(0, weight);
      const orange = count(1, weight);
      if (blue !== orange) return blue > orange ? "blue" : "orange";
    }
    return null;
  });
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
  const colours = ourColours(replays, team.rosterNames);
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
  }
  return { teamKey: team.key, placements, matched: placements.filter((p) => p.seriesId).length };
}

/**
 * Both City teams play on the same nights, so decide whose replays these are: the team whose
 * series scores they add up to. Null team when none fits or two fit equally well.
 */
export function sortForTeams(replays: SortReplay[], teams: SortTeam[]): { teamKey: string | null; result: SortResult | null; byTeam: SortResult[] } {
  const byTeam = teams.map((t) => sortReplays(replays, t));
  const top = Math.max(0, ...byTeam.map((r) => r.matched));
  const best = byTeam.filter((r) => r.matched === top);
  if (top === 0 || best.length !== 1) return { teamKey: null, result: null, byTeam };
  return { teamKey: best[0].teamKey, result: best[0], byTeam };
}
