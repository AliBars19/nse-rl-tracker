/**
 * Snapshot NSE match tables into seed-data/nse/*.json.
 *
 *   npx tsx scripts/fetch-nse.ts
 *
 * Only the server-rendered pages are fetched (week pages, Stage 1 and our teams'
 * match lists). The raw HTML is not kept, just the parsed rows.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseNseMatchTable } from "../src/lib/import/nse";

const BASE = "https://tournaments.nse.gg/tournaments";
const OUT = join(process.cwd(), "seed-data", "nse");

const PAGES: Array<{ tournament: string; page: string }> = [
  // Division 2 (City Champions)
  ...["week-3", "week-4", "week-5", "week-6"].map((page) => ({
    tournament: "rocket-league-nse-spring-26-division-2",
    page,
  })),
  { tournament: "rocket-league-nse-spring-26-division-2", page: "teams/city-champions/matches" },
  // Swiss (City Commanders)
  ...["stage-1", "week-3", "week-4", "week-5", "week-6"].map((page) => ({
    tournament: "rocket-league-nse-spring-26",
    page,
  })),
  { tournament: "rocket-league-nse-spring-26", page: "teams/city-commanders/matches" },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  for (const { tournament, page } of PAGES) {
    const url = `${BASE}/${tournament}/${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    const rows = parseNseMatchTable(await res.text());
    const file = join(OUT, `${tournament}--${page.replace(/\//g, "_")}.json`);
    // One row per line keeps the snapshots small and diff-friendly.
    const body = rows.map((r) => "  " + JSON.stringify(r)).join(",\n");
    const header = `{\n "source": ${JSON.stringify(url)},\n "fetchedAt": ${JSON.stringify(new Date().toISOString())},\n "rows": [\n`;
    writeFileSync(file, `${header}${body}\n ]\n}\n`);
    console.log(`${rows.length.toString().padStart(4)} rows  ${url}`);
    await new Promise((r) => setTimeout(r, 400)); // be polite
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
