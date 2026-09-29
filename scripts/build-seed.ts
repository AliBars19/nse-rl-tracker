/**
 * Build the Spring 26 dataset from the raw sources in seed-data/:
 *   - seed-data/nse/*.json   NSE match tables (run scripts/fetch-nse.ts to refresh)
 *   - seed-data/*.csv        NSE standings sheet tabs
 *   - scripts/seed-config.ts rosters and tournament mapping
 *
 * Writes:
 *   - src/data/seed/spring-26.json  (used by the site when Supabase is not configured)
 *   - supabase/seed.sql             (loads the same data into Postgres)
 *
 *   npm run seed:build
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  Dataset,
  ExternalNightResult,
  ExternalStanding,
  Night,
  Player,
  RosterEntry,
  Season,
  Series,
  Team,
  TeamSeason,
  Tier,
} from "../src/lib/domain/types";
import { classifyNseRound, nseDateToIso, type NseMatchRow } from "../src/lib/import/nse";
import { rowToSeries } from "../src/lib/import/nse-series";
import { defaultShortName, nameKey, slugify } from "../src/lib/import/names";
import { parseStandingsSheet, SPRING_26_LAYOUTS } from "../src/lib/import/sheet";
import { OUR_TEAMS, SEASON, SHEET_ALIASES, TIERS } from "./seed-config";
import { datasetToSql } from "./seed-sql";

const ROOT = process.cwd();

/** Deterministic UUID (v5-style) so re-running the build keeps ids stable. */
function uuid(...parts: Array<string | number>): string {
  const h = createHash("sha1").update(["nse-rl-tracker", ...parts].join("|")).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

function readSnapshot(tournament: string, page: string): NseMatchRow[] {
  const file = join(ROOT, "seed-data", "nse", `${tournament}--${page}.json`);
  return JSON.parse(readFileSync(file, "utf8")).rows as NseMatchRow[];
}

const season: Season = { id: uuid("season", SEASON.slug), ...SEASON };

// ---------------------------------------------------------------- teams
const teams = new Map<string, Team>(); // key: nse slug or name key
const teamByName = new Map<string, Team>();

function teamFor(ref: { slug: string | null; name: string }): Team {
  const key = ref.slug ?? `name:${nameKey(ref.name)}`;
  let t = teams.get(key) ?? teamByName.get(nameKey(ref.name));
  if (!t) {
    const our = OUR_TEAMS.find((o) => o.nseSlug === ref.slug);
    let slug = slugify(ref.name);
    const taken = new Set([...teams.values()].map((x) => x.slug));
    for (let i = 2; taken.has(slug); i++) slug = `${slugify(ref.name)}-${i}`;
    t = {
      id: uuid("team", key),
      slug,
      name: ref.name,
      shortName: defaultShortName(ref.name),
      nseSlug: ref.slug,
      ourKey: our?.key ?? null,
    };
  }
  teams.set(key, t);
  teamByName.set(nameKey(ref.name), t);
  return t;
}

// ---------------------------------------------------------------- nights + series
const nights: Night[] = [];
const series = new Map<number, Series>();
const warnings: string[] = [];

function addSeries(row: NseMatchRow, tier: Tier, night: Night | null) {
  const r = rowToSeries(row, {
    seasonId: season.id,
    tier,
    night,
    teamId: (ref) => teamFor(ref).id,
    seriesId: (id) => uuid("series", id),
  });
  if ("series" in r) series.set(row.id, r.series);
  else if (!/admin points row|bye vs bye/.test(r.skip)) warnings.push(`Match ${row.id}: ${r.skip}`);
}

for (const t of TIERS) {
  for (const n of t.nights) {
    const rows = n.pages.flatMap((p) => readSnapshot(t.tournament, p));
    const dates = [...new Set(rows.map((r) => nseDateToIso(r.date)))].sort();
    const venues = rows.map((r) => r.venue).filter(Boolean) as string[];
    const venue = venues.sort((a, b) => venues.filter((v) => v === b).length - venues.filter((v) => v === a).length)[0] ?? null;
    const night: Night = {
      id: uuid("night", season.slug, t.tier, n.week),
      seasonId: season.id,
      tier: t.tier,
      stage: n.stage,
      week: n.week,
      label: n.label,
      date: dates[0],
      venue,
    };
    nights.push(night);
    for (const row of rows) addSeries(row, t.tier, night);
  }
}

// Our teams' own match lists carry the playoff rows.
for (const o of OUR_TEAMS) {
  for (const row of readSnapshot(o.tournament, o.matchesPage)) {
    if (classifyNseRound(row.round).kind === "playoff") addSeries(row, o.tier, null);
  }
}

// ---------------------------------------------------------------- sheet
const externalResults: ExternalNightResult[] = [];
const externalStandings: ExternalStanding[] = [];

for (const t of TIERS) {
  const csv = readFileSync(join(ROOT, "seed-data", t.sheet), "utf8");
  for (const row of parseStandingsSheet(csv, SPRING_26_LAYOUTS[t.tier])) {
    for (const w of row.warnings) warnings.push(`[sheet ${t.tier}] ${row.team}: ${w}`);
    const alias = SHEET_ALIASES[row.team];
    // Teams get renamed on NSE but keep their slug, and the sheet often uses the old name.
    const compact = nameKey(alias ?? row.team).replace(/ /g, "");
    let team =
      teamByName.get(nameKey(alias ?? row.team)) ??
      [...teams.values()].find((t) => t.nseSlug?.replace(/[^a-z0-9]/g, "") === compact);
    if (!team) {
      warnings.push(`[sheet ${t.tier}] "${row.team}" has no NSE matches; created from the sheet`);
      team = teamFor({ slug: null, name: row.team });
    }
    externalStandings.push({
      seasonId: season.id,
      tier: t.tier,
      teamId: team.id,
      position: row.position,
      total: row.total,
      playoffNote: row.playoffNote,
    });
    for (const c of row.cells) {
      if (c.status === "absent" && c.points === null) continue;
      const night = nights.find((n) => n.tier === t.tier && n.week === c.week);
      if (!night) {
        warnings.push(`[sheet ${t.tier}] no night for week ${c.week}`);
        continue;
      }
      externalResults.push({ nightId: night.id, teamId: team.id, points: c.points, status: c.status });
    }
  }
}

// ---------------------------------------------------------------- our teams, players
const teamSeasons: TeamSeason[] = [];
const players = new Map<string, Player>();
const roster: RosterEntry[] = [];

for (const o of OUR_TEAMS) {
  const team = [...teams.values()].find((t) => t.nseSlug === o.nseSlug);
  if (!team) throw new Error(`Our team ${o.nseSlug} not found in NSE data`);
  team.ourKey = o.key;
  teamSeasons.push({ seasonId: season.id, teamId: team.id, tier: o.tier, nseTournamentSlug: o.tournament });
  for (const r of o.roster) {
    let p = players.get(r.profile);
    if (!p) {
      p = {
        id: uuid("player", r.profile),
        slug: slugify(r.nickname),
        nickname: r.nickname,
        nseProfileUrl: `https://tournaments.nse.gg/profiles/${r.profile}`,
        platformIds: null,
      };
      players.set(r.profile, p);
    }
    roster.push({ teamId: team.id, seasonId: season.id, playerId: p.id, role: r.role });
  }
}

// ---------------------------------------------------------------- output
const dataset: Dataset = {
  season,
  seasons: [season],
  teams: [...new Set(teams.values())].sort((a, b) => a.name.localeCompare(b.name)),
  teamSeasons,
  nights: nights.sort((a, b) => a.tier.localeCompare(b.tier) || a.week - b.week),
  series: [...series.values()].sort((a, b) => (a.nseMatchId ?? 0) - (b.nseMatchId ?? 0)),
  externalResults,
  externalStandings,
  players: [...players.values()],
  roster,
  games: [],
  playerGameStats: [],
  upcoming: [],
};

const outDir = join(ROOT, "src", "data", "seed");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `${season.slug}.json`), JSON.stringify(dataset) + "\n");
writeFileSync(join(ROOT, "supabase", "seed.sql"), datasetToSql(dataset));

console.log(
  `teams ${dataset.teams.length} · nights ${dataset.nights.length} · series ${dataset.series.length} · ` +
    `sheet cells ${externalResults.length} · standings rows ${externalStandings.length} · players ${dataset.players.length}`,
);
if (warnings.length) {
  console.log(`\n${warnings.length} warnings:`);
  for (const w of warnings) console.log(`  - ${w}`);
}
