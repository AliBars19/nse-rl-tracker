/**
 * Parser for NSE tournament match tables (tournaments.nse.gg).
 *
 * Week pages (`/week-3`), team match lists (`/teams/<slug>/matches`) and
 * `/stage-1` are server-rendered HTML tables, one <tr> per match. The tournament
 * overview and playoff brackets are rendered with JS and cannot be parsed this way.
 */

export interface NseTeamRef {
  slug: string | null; // null for 'Bye'
  name: string;
}

export interface NseMatchRow {
  id: number;
  /** Kick-off, UK local time, as shown: '19:15'. */
  time: string;
  /** As shown: '17 Feb 26'. */
  date: string;
  home: NseTeamRef;
  away: NseTeamRef;
  homeScore: number | null;
  awayScore: number | null;
  /** 'Round 1', 'Points', 'Promotion Match and Points', 'Last 16', ... */
  round: string;
  /** 'Beckwith Park Night' */
  venue: string | null;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

/** Collapse runs of whitespace and trim. NSE names often contain double spaces. */
export function cleanName(s: string): string {
  return decodeEntities(s).replace(/\s+/g, " ").trim();
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ");
}

function cell(tr: string, cls: string): string | null {
  const m = tr.match(new RegExp(`<td class="matches-${cls}[^"]*"[^>]*>([\\s\\S]*?)</td>`));
  return m ? m[1] : null;
}

function teamFromCell(html: string | null): NseTeamRef {
  if (!html) return { slug: null, name: "" };
  const a = html.match(/\/teams\/([^/"]+)\/matches"\s+title="([^"]*)"/);
  if (a) return { slug: a[1], name: cleanName(a[2]) };
  return { slug: null, name: cleanName(stripTags(html)) };
}

function score(html: string | null): number | null {
  if (!html) return null;
  const m = stripTags(html).match(/-?\d+/);
  return m ? Number(m[0]) : null;
}

export function parseNseMatchTable(html: string): NseMatchRow[] {
  const rows = new Map<number, NseMatchRow>();
  for (const [, tr] of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const idCell = cell(tr, "id");
    const id = idCell ? Number(stripTags(idCell).trim()) : NaN;
    if (!Number.isFinite(id) || id <= 0) continue;

    const timeCell = cell(tr, "time") ?? "";
    const [time = "", date = ""] = timeCell.split(/<br\s*\/?>/).map((s) => cleanName(stripTags(s)));

    const roundCell = cell(tr, "round") ?? "";
    const [round = "", venue = ""] = roundCell.split(/<br\s*\/?>/).map((s) => cleanName(stripTags(s)));

    rows.set(id, {
      id,
      time,
      date,
      home: teamFromCell(cell(tr, "hometeam")),
      away: teamFromCell(cell(tr, "awayteam")),
      homeScore: score(cell(tr, "homescore")),
      awayScore: score(cell(tr, "awayscore")),
      round,
      venue: venue || null,
    });
  }
  return [...rows.values()].sort((a, b) => a.id - b.id);
}

const MONTHS: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

/** '17 Feb 26' -> '2026-02-17' */
export function nseDateToIso(date: string): string {
  const m = date.match(/^(\d{1,2}) (\w{3}) (\d{2})$/);
  if (!m || !MONTHS[m[2]]) throw new Error(`Unrecognised NSE date: ${date}`);
  const [, d, mon, yy] = m;
  return `20${yy}-${String(MONTHS[mon]).padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** Offset of Europe/London from UTC at a given instant, in minutes (0 in winter, 60 in summer). */
function londonOffsetMinutes(utc: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(utc);
  const h = Number(parts.find((p) => p.type === "hour")?.value);
  const m = Number(parts.find((p) => p.type === "minute")?.value);
  let diff = h * 60 + m - (utc.getUTCHours() * 60 + utc.getUTCMinutes());
  if (diff < -720) diff += 1440;
  if (diff > 720) diff -= 1440;
  return diff;
}

/** NSE date + UK kick-off time -> ISO UTC timestamp. */
export function nseKickoffToIso(date: string, time: string): string {
  const day = nseDateToIso(date);
  const [hh, mm] = time.split(":").map(Number);
  const guess = new Date(`${day}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`);
  const offset = londonOffsetMinutes(guess);
  return new Date(guess.getTime() - offset * 60_000).toISOString();
}

/** Classify NSE's round column. */
export type NseRoundKind =
  | { kind: "round"; round: number }
  | { kind: "promotion" }
  | { kind: "points" }
  | { kind: "playoff"; playoffRound: "last32" | "last16" | "qf" | "sf" | "final" }
  | { kind: "unknown" };

export function classifyNseRound(label: string): NseRoundKind {
  const r = label.match(/^Round (\d+)$/i);
  if (r) return { kind: "round", round: Number(r[1]) };
  if (/^points$/i.test(label)) return { kind: "points" };
  if (/promotion match/i.test(label)) return { kind: "promotion" };
  if (/last 32/i.test(label)) return { kind: "playoff", playoffRound: "last32" };
  if (/last 16/i.test(label)) return { kind: "playoff", playoffRound: "last16" };
  if (/quarter/i.test(label)) return { kind: "playoff", playoffRound: "qf" };
  if (/semi/i.test(label)) return { kind: "playoff", playoffRound: "sf" };
  if (/final/i.test(label)) return { kind: "playoff", playoffRound: "final" };
  return { kind: "unknown" };
}

/**
 * A series recorded 1–0 in a best-of-5 (or longer) is a forfeit: it counts as a win
 * for points but is excluded from game-level stats.
 */
export function looksLikeForfeit(homeScore: number | null, awayScore: number | null, bestOf: number): boolean {
  if (homeScore === null || awayScore === null || bestOf < 3) return false;
  const hi = Math.max(homeScore, awayScore);
  const lo = Math.min(homeScore, awayScore);
  return hi === 1 && lo === 0;
}
