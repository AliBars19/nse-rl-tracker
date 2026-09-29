/**
 * Defensive parser for the NSE standings Google Sheet (CSV export, one tab per tier).
 *
 * Quirks it handles:
 *  - Week columns mix numbers and status text ("Promoted to Div 1", "Demoted to Swiss").
 *    A status cell is an *event*, not points.
 *  - Status text is relative to the tab: in the Division 2 tab, "Promoted to Div 1"
 *    means the team left; in the Division 1 tab it means the team arrived.
 *  - The Swiss tab's header row is misaligned (it says Stage 1, Wk3, Wk4, Wk5, Total but
 *    has five weekly values plus a total), so columns are mapped by position from a
 *    per-tier layout rather than trusted from the header.
 *  - Rows without a position are teams that left the tier (or were placed elsewhere).
 */
import type { NightStatus, Tier } from "@/lib/domain/types";

/** Split CSV text into rows of cells. Handles quoted cells with commas, quotes and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Column layout for one tab: which CSV column holds each week's value. */
export interface SheetLayout {
  tier: Tier;
  /** [week number, column index] pairs. Swiss Stage 1 is week 1. */
  weeks: Array<[number, number]>;
  totalColumn: number;
  playoffColumn: number | null;
}

export const SPRING_26_LAYOUTS: Record<Tier, SheetLayout> = {
  // Standings,Team,Week 3,Week 4,Week 5,Week 6,Total,Division,Bye Rounds
  div1: { tier: "div1", weeks: [[3, 2], [4, 3], [5, 4], [6, 5]], totalColumn: 6, playoffColumn: 8 },
  // Standings,Team,Week 3,Week 4,Week 5,Week 6,Total,Playoff Byes
  div2: { tier: "div2", weeks: [[3, 2], [4, 3], [5, 4], [6, 5]], totalColumn: 6, playoffColumn: 7 },
  // Standings,Team,Stage 1,Week 3,Week 4,Week 5,Total  <- header is wrong: there is also Week 6
  swiss: { tier: "swiss", weeks: [[1, 2], [3, 3], [4, 4], [5, 5], [6, 6]], totalColumn: 7, playoffColumn: null },
};

export interface SheetCell {
  week: number;
  points: number | null;
  status: NightStatus;
  raw: string;
}

export interface SheetRow {
  position: number | null;
  team: string;
  cells: SheetCell[];
  total: number | null;
  playoffNote: string | null;
  /** Anything odd about the row, for the import diff preview. */
  warnings: string[];
}

const TIER_WORDS: Array<[RegExp, Tier]> = [
  [/div(ision)?\s*1\b/i, "div1"],
  [/div(ision)?\s*2\b/i, "div2"],
  [/swiss/i, "swiss"],
];

function tierIn(text: string): Tier | null {
  for (const [re, tier] of TIER_WORDS) if (re.test(text)) return tier;
  return null;
}

/** Interpret one week cell relative to the tab's tier. */
export function parseCell(raw: string, tabTier: Tier, week: number): SheetCell & { warning?: string } {
  const text = raw.trim();
  if (text === "" || text === "-" || text === "—") return { week, points: null, status: "absent", raw };
  if (/^-?\d+(\.\d+)?$/.test(text)) return { week, points: Number(text), status: "played", raw };

  const target = tierIn(text);
  const promoted = /promot/i.test(text);
  const demoted = /demot|relegat/i.test(text);
  if ((promoted || demoted) && target) {
    const arrived = target === tabTier;
    const status: NightStatus = promoted
      ? arrived
        ? "promoted_in"
        : "promoted_out"
      : arrived
        ? "relegated_in"
        : "relegated_out";
    return { week, points: null, status, raw };
  }
  return { week, points: null, status: "absent", raw, warning: `Unrecognised cell "${text}" in week ${week}` };
}

function toInt(s: string | undefined): number | null {
  if (s === undefined) return null;
  const t = s.trim();
  return /^-?\d+$/.test(t) ? Number(t) : null;
}

/** Parse one tab's CSV into rows. Header/title rows are skipped. */
export function parseStandingsSheet(csv: string, layout: SheetLayout): SheetRow[] {
  const out: SheetRow[] = [];
  for (const cells of parseCsv(csv)) {
    const team = (cells[1] ?? "").replace(/\s+/g, " ").trim();
    const first = (cells[0] ?? "").trim();
    if (!team || team.toLowerCase() === "team") continue;
    if (first !== "" && toInt(first) === null) continue; // title rows like "Division 2,..."

    const warnings: string[] = [];
    const weekCells: SheetCell[] = layout.weeks.map(([week, col]) => {
      const c = parseCell(cells[col] ?? "", layout.tier, week);
      if (c.warning) warnings.push(c.warning);
      return { week: c.week, points: c.points, status: c.status, raw: c.raw };
    });

    const total = toInt(cells[layout.totalColumn]);
    const summed = weekCells.reduce((s, c) => s + (c.points ?? 0), 0);
    if (total !== null && total !== summed) warnings.push(`Total ${total} does not match week sum ${summed}`);

    const note = layout.playoffColumn !== null ? (cells[layout.playoffColumn] ?? "").trim() : "";
    out.push({
      position: toInt(first),
      team,
      cells: weekCells,
      total,
      playoffNote: note || null,
      warnings,
    });
  }
  return out;
}

/** "Bye Round 1 and 2" -> "Bye R1 + R2" (design copy). */
export function shortPlayoffNote(note: string | null): string {
  if (!note) return "";
  return note
    .replace(/Bye Round 1 and 2/i, "Bye R1 + R2")
    .replace(/Bye Round 1/i, "Bye R1")
    .trim();
}

export const SHEET_ID = "1obgH4V6-QKiJsIEeBDrtlSibw3XbBlEcq3_6XPuREzg";
export const SHEET_GIDS: Record<Tier, string> = { div1: "915740849", div2: "427419427", swiss: "2071657847" };

export function sheetCsvUrl(tier: Tier, sheetId = SHEET_ID, gids = SHEET_GIDS): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gids[tier]}`;
}
