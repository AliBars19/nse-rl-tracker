import "server-only";
import { formTag } from "@/lib/import/names";
import { LADDER_ORDER } from "@/lib/engine/points";
import { playerLines } from "@/lib/engine/players";
import { scenarioPreview, type ScenarioPreview } from "@/lib/engine/preview";
import { TIER_NAMES } from "@/lib/engine/rulesets";
import { standingsTable, type StandingsTable } from "@/lib/engine/standings";
import { fmtRecord, form, ordinal, PLAYOFF_ROUND_NAMES, playoffSummary, seasonStats } from "@/lib/engine/stats";
import type { TeamPage } from "./team";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dayDate(iso: string, withDay = true): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return `${withDay ? `${DAYS[d.getUTCDay()]} ` : ""}${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function longDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  const long = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()];
  const month = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][d.getUTCMonth()];
  return `${long} ${d.getUTCDate()} ${month} ${d.getUTCFullYear()}`;
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export interface WeekRow {
  key: string;
  name: string; // 'WEEK 3'
  short: string; // 'WK 3'
  date: string; // 'Tue 17 Feb'
  href: string;
  points: number | null;
  path: string;
  mismatch: string | null;
  rounds: Array<{ key: string; label: string; opp: string; res: "W" | "L" | "BYE"; score: string }>;
}

export interface DashboardView {
  hero: {
    name: string;
    summary: string;
    phoneSummary: string;
    rank: number | null;
    field: number | null;
    points: number;
  };
  tiles: Array<{ label: string; phoneLabel: string; value: string; note: string; phoneNote: string }>;
  weeks: WeekRow[];
  chart: { max: number; caption: string };
  form: Array<{ key: string; res: "W" | "L"; tag: string; score: string; opp: string }>;
  ladder: { tierName: string; rows: Array<{ path: string; extra: string; pts: number; hits: string }> } | null;
  ladderNote: string;
  roster: Array<{ name: string; slug: string; role: string; line: string | null }>;
  scenarios: ScenarioPreview | null;
  standings: StandingsTable;
  tierName: string;
}

export function buildDashboard(p: TeamPage): DashboardView {
  const { ctx, team, teamSeason, ruleset, season, nights, ds } = p;
  const table = standingsTable(ctx, teamSeason.tier);
  const ours = table.rows.find((r) => r.team.id === team.id);
  const stats = seasonStats(season, nights);
  const po = playoffSummary(season);
  const finished = ds.season.isFinished;
  const field = table.rows.length || null;
  const rank = ours?.position ?? null;
  const points = ours?.total ?? stats.nights.total;
  const tierName = TIER_NAMES[teamSeason.tier].long;

  const place = rank ? `${finished ? "Finished" : "Currently"} ${ordinal(rank)} of ${field}` : null;
  const summary = [tierName, place, po ? `Playoffs: ${po}` : null].filter(Boolean).join(" · ");
  const lastPo = season.filter((s) => s.series.stage === "playoff" && s.result !== "BYE").at(-1);
  const phoneSummary = [
    ds.season.name,
    tierName,
    lastPo
      ? `${lastPo.result === "W" ? "Won" : "Lost"} ${lastPo.series.playoffRound ? PLAYOFF_ROUND_NAMES[lastPo.series.playoffRound] : "playoff"} ` +
        `${lastPo.our}–${lastPo.opp} ${lastPo.result === "W" ? "vs" : "to"} ${lastPo.opponent?.shortName}`
      : place,
  ]
    .filter(Boolean)
    .join(" · ");

  const ff = stats.series.forfeitWins + stats.series.forfeitLosses;
  const ffGames = season.filter((s) => s.series.isForfeit).length;
  const deciders = stats.deciders.w + stats.deciders.l;
  const tiles = [
    {
      label: "Series record",
      phoneLabel: "Series",
      value: fmtRecord(stats.series),
      note: ff ? `Includes ${stats.series.forfeitWins ? plural(stats.series.forfeitWins, "forfeit win") : plural(stats.series.forfeitLosses, "forfeit loss", "forfeit losses")}` : "No forfeits",
      phoneNote: ff ? `Incl. ${plural(ff, "forfeit")}` : "No forfeits",
    },
    {
      label: "Game record",
      phoneLabel: "Games",
      value: fmtRecord(stats.games),
      note: ffGames ? (ffGames === 1 ? "Forfeit excluded" : "Forfeits excluded") : "Every series played out",
      phoneNote: ffGames ? (ffGames === 1 ? "Forfeit excluded" : "Forfeits excluded") : "All played",
    },
    {
      label: "Game 5s",
      phoneLabel: "Game 5s",
      value: fmtRecord(stats.deciders),
      note: deciders ? `Won ${stats.deciders.w} of ${plural(deciders, "decider")}` : "No series went the distance",
      phoneNote: "Deciders won",
    },
    {
      label: "Avg per night",
      phoneLabel: "Avg / night",
      value: stats.nights.avg === null ? "—" : stats.nights.avg.toFixed(1),
      note: stats.nights.count ? `Best ${stats.nights.best} · worst ${stats.nights.worst}` : "No nights yet",
      phoneNote: stats.nights.count ? `Best ${stats.nights.best} · worst ${stats.nights.worst}` : "No nights yet",
    },
  ];

  const weeks: WeekRow[] = nights.map((n) => {
    const dates = [...new Set(n.rounds.map((r) => r.ts.series.playedAt?.slice(0, 10)).filter(Boolean))] as string[];
    const date =
      dates.length > 1
        ? `${dayDate(dates[0])} & ${dayDate(dates.at(-1)!, false)}`
        : dayDate(dates[0] ?? n.night.date);
    return {
      key: n.night.id,
      name: n.night.label.toUpperCase(),
      short: n.night.stage === "placement" ? "STG 1" : `WK ${n.night.week}`,
      date,
      href: `${p.base}/matches/${n.night.stage === "placement" ? "stage-1" : `week-${n.night.week}`}`,
      points: n.points,
      path: n.path,
      mismatch: n.mismatch ? `Engine ${n.computed?.points}, NSE sheet ${n.sheet?.points}` : null,
      rounds: n.rounds.map((r) => ({
        key: r.ts.series.id,
        label: r.label,
        opp: r.ts.opponent?.shortName ?? "Bye",
        res: r.ts.result,
        score: r.ts.result === "BYE" ? "" : r.ts.series.isForfeit ? "FF" : `${r.ts.our}–${r.ts.opp}`,
      })),
    };
  });

  const maxPts = ruleset.ladder ? Math.max(...Object.values(ruleset.ladder)) : Math.max(10, ...weeks.map((w) => w.points ?? 0));

  let ladder: DashboardView["ladder"] = null;
  if (ruleset.ladder) {
    const hits = new Map<string, number>();
    for (const n of nights) if (n.computed) hits.set(n.computed.key, (hits.get(n.computed.key) ?? 0) + 1);
    ladder = {
      tierName,
      rows: LADDER_ORDER.map((key) => {
        const [b, r] = key.split(":");
        const extra = key === "2-0:W" && ruleset.promotesTo ? "(promoted)" : key === "0-2:L" && ruleset.relegatesTo ? "(relegated)" : "";
        const h = hits.get(key) ?? 0;
        return { path: `${b.replace("-", "–")} → ${r === "W" ? "win" : "lose"} R3`, extra, pts: ruleset.ladder![key], hits: h ? `You ×${h}` : "" };
      }),
    };
  }

  const lines = playerLines(ctx, team.id, season);
  const roster = lines.map((l) => ({
    name: l.player.nickname,
    slug: l.player.slug,
    role: l.role === "leader" ? "Team leader" : l.role === "sub" ? "Sub" : "Player",
    line: l.gp ? `${l.totals.goals} G · ${l.totals.assists} A · ${l.totals.saves} Sv` : null,
  }));

  return {
    hero: { name: team.name, summary, phoneSummary, rank, field, points },
    tiles,
    weeks,
    chart: { max: maxPts, caption: ruleset.ladder ? `Max ${maxPts} per night` : "Points from the NSE sheet" },
    form: form(season).map((f) => ({
      key: f.series.id,
      res: f.result as "W" | "L",
      tag: formTag(f.opponent?.shortName ?? ""),
      score: `${f.our}–${f.opp}`,
      opp: f.opponent?.shortName ?? "",
    })),
    ladder,
    ladderNote: ruleset.note,
    roster,
    scenarios: scenarioPreview(ctx, team.id, teamSeason.tier),
    standings: table,
    tierName,
  };
}
