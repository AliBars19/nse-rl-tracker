import "server-only";
import type { TeamSeries } from "@/lib/engine/context";
import { seriesScoreboard } from "@/lib/engine/players";
import { nightSlugOf } from "@/lib/engine/scouting";
import { scrimResult, scrimScore } from "@/lib/engine/scrims";
import { PLAYOFF_ROUND_NAMES } from "@/lib/engine/stats";
import { dayDate, longDate } from "./dashboard";
import type { TeamPage } from "./team";

export interface NightTab {
  slug: string;
  label: string; // 'WK 3' | 'STG 1' | 'PLAYOFFS' | 'SCRIMS'
}

export function nightTabs(p: TeamPage): NightTab[] {
  const tabs: NightTab[] = p.nights.map((n) => ({
    slug: n.night.stage === "placement" ? "stage-1" : `week-${n.night.week}`,
    label: n.night.stage === "placement" ? "STG 1" : `WK ${n.night.week}`,
  }));
  if (p.season.some((s) => s.series.stage === "playoff")) tabs.push({ slug: "playoffs", label: "PLAYOFFS" });
  if (p.scrims.length) tabs.push({ slug: "scrims", label: "SCRIMS" });
  return tabs;
}

/** Default night for /matches: the latest league night (as in the approved design). */
export function defaultNightSlug(p: TeamPage): string | null {
  const tabs = nightTabs(p).filter((t) => t.slug !== "playoffs" && t.slug !== "scrims");
  return tabs.at(-1)?.slug ?? (nightTabs(p)[0]?.slug ?? null);
}

export interface PathCard {
  ts: TeamSeries;
  title: string; // 'ROUND 3 · 1–1 DECIDER' | 'SCRIM · THU 12 MAR'
  opp: string;
  score: string;
  /** Colour; null for a scrim with no score yet. */
  res: "W" | "L" | "BYE" | "D" | null;
  /** 'WIN' | 'LOSS' | 'DRAW' next to the score (none for byes and unscored scrims). */
  resLabel: string | null;
  after: string | null; // 'Record after: 2–1'
  focused: boolean;
}

const RES_LABEL = { W: "WIN", L: "LOSS", D: "DRAW" } as const;

export interface MatchesView {
  /** Night and playoff cards are a path (chevrons between them); scrims are a plain list. */
  kind: "night" | "playoffs" | "scrims";
  title: string;
  dateLine: string;
  cards: PathCard[];
  result: { big: string; label: string; caption: string };
  selected: {
    ts: TeamSeries;
    heading: string;
    games: Array<{ n: number; our: number | null; opp: number | null; overtime: boolean; processed: boolean }>;
    /** Series score in the heading; null for a bye or an unscored scrim. */
    score: { our: number; opp: number; res: "W" | "L" | "D" } | null;
    /** Placeholder shown when there are no game slots. */
    empty: string;
    boards: Array<{ team: string; res: "W" | "L"; rows: ReturnType<typeof seriesScoreboard> }>;
    oppSlug: string | null;
  } | null;
}

export function buildMatches(p: TeamPage, slug: string, seriesId: string | null): MatchesView | null {
  let cards: PathCard[];
  let title: string;
  let dateLine: string;
  let result: MatchesView["result"];
  let kind: MatchesView["kind"] = "night";

  if (slug === "scrims") {
    if (!p.scrims.length) return null;
    kind = "scrims";
    const scored = p.scrims.map((ts) => ({ ts, score: scrimScore(p.ctx, ts) }));
    cards = [...scored].reverse().map(({ ts, score }) => {
      const res = scrimResult(score);
      const replays = p.ds.games.filter((g) => g.seriesId === ts.series.id && g.processedAt).length;
      return {
        ts,
        title: `SCRIM · ${ts.series.playedAt ? dayDate(ts.series.playedAt).toUpperCase() : "DATE TBC"}`,
        opp: ts.opponent?.shortName ?? "Opponent TBC",
        score: score ? `${score.our}–${score.opp}` : "—",
        res,
        resLabel: res ? RES_LABEL[res] : null,
        after: replays ? `${replays} ${replays === 1 ? "replay" : "replays"}` : "No replays yet",
        focused: false,
      };
    });
    const tally = { W: 0, L: 0, D: 0 };
    for (const { score } of scored) {
      const r = scrimResult(score);
      if (r) tally[r]++;
    }
    title = "Scrims";
    dateLine = "Practice series: they count towards player stats, never points or records";
    result = {
      big: tally.W + tally.L + tally.D ? `${tally.W}–${tally.L}` : "—",
      label: "SCRIMS",
      caption: [tally.D ? `${tally.D} drawn` : null, "No points"].filter(Boolean).join(" · "),
    };
  } else if (slug === "playoffs") {
    const po = p.season.filter((s) => s.series.stage === "playoff");
    if (!po.length) return null;
    cards = po.map((ts) => ({
      ts,
      title: (ts.series.playoffRound ? PLAYOFF_ROUND_NAMES[ts.series.playoffRound] : "Playoffs").toUpperCase(),
      opp: ts.opponent?.shortName ?? "Bye",
      score: ts.result === "BYE" ? "BYE" : `${ts.our}–${ts.opp}`,
      res: ts.result,
      resLabel: ts.result === "BYE" ? null : RES_LABEL[ts.result],
      after: ts.result === "BYE" ? "Seeded through" : ts.result === "W" ? "Through" : "Eliminated",
      focused: false,
    }));
    const last = po.at(-1)!;
    const lastRound = last.series.playoffRound ? PLAYOFF_ROUND_NAMES[last.series.playoffRound] : "playoffs";
    kind = "playoffs";
    title = "Playoffs";
    const dates = [...new Set(po.map((s) => s.series.playedAt?.slice(0, 10)).filter(Boolean))] as string[];
    dateLine = dates.map(longDate).join(" · ");
    result =
      last.result === "L"
        ? { big: "OUT", label: "PLAYOFFS", caption: `Lost in the ${lastRound}` }
        : { big: last.series.playoffRound === "final" ? "WON" : "IN", label: "PLAYOFFS", caption: last.series.playoffRound === "final" ? "Champions" : `Through the ${lastRound}` };
  } else {
    const tn = p.nights.find((n) => (n.night.stage === "placement" ? "stage-1" : `week-${n.night.week}`) === slug);
    if (!tn) return null;
    cards = tn.rounds.map((r) => ({
      ts: r.ts,
      title: r.title.toUpperCase(),
      opp: r.ts.opponent?.shortName ?? "Bye",
      score: r.ts.result === "BYE" ? "BYE" : `${r.ts.our}–${r.ts.opp}`,
      res: r.ts.result,
      resLabel: r.ts.result === "BYE" ? null : RES_LABEL[r.ts.result],
      after: `Record after: ${r.recordAfter.w}–${r.recordAfter.l}`,
      focused: false,
    }));
    title = tn.night.label;
    const dates = [...new Set(tn.rounds.map((r) => r.ts.series.playedAt?.slice(0, 10)).filter(Boolean))] as string[];
    dateLine = [(dates.length ? dates : [tn.night.date]).map(longDate).join(" & "), tn.night.venue].filter(Boolean).join(" · ");
    result = { big: tn.points === null ? "—" : `+${tn.points}`, label: "NIGHT RESULT", caption: tn.path };
  }

  const focus =
    cards.find((c) => c.ts.series.id === seriesId) ??
    (kind === "scrims" ? cards[0] : ([...cards].reverse().find((c) => c.res !== "BYE") ?? cards.at(-1)!));
  focus.focused = true;

  const ts = focus.ts;
  let selected: MatchesView["selected"] = null;
  if (ts) {
    const isScrim = kind === "scrims";
    const bo = `BEST OF ${ts.series.bestOf}`;
    const heading = isScrim
      ? `${focus.title} · NO POINTS`
      : [focus.title, ts.series.isForfeit ? "FORFEIT" : ts.result === "BYE" ? null : bo].filter(Boolean).join(" · ");
    const uploaded = Math.max(0, ...p.ds.games.filter((g) => g.seriesId === ts.series.id).map((g) => g.gameNumber));
    const scrim = isScrim ? scrimScore(p.ctx, ts) : null;
    const played = isScrim
      ? Math.max(uploaded, scrim?.source === "entered" ? scrim.our + scrim.opp : 0)
      : ts.series.isForfeit || ts.result === "BYE"
        ? 0
        : (ts.our ?? 0) + (ts.opp ?? 0);
    const home = ts.series.homeTeamId === p.team.id;
    const games = Array.from({ length: played }, (_, i) => {
      const g = p.ds.games.find((x) => x.seriesId === ts.series.id && x.gameNumber === i + 1);
      const processed = !!g?.processedAt;
      return {
        n: i + 1,
        our: processed ? ((home ? g!.homeGoals : g!.awayGoals) ?? null) : null,
        opp: processed ? ((home ? g!.awayGoals : g!.homeGoals) ?? null) : null,
        overtime: !!g?.overtime,
        processed,
      };
    });
    const score: NonNullable<MatchesView["selected"]>["score"] = isScrim
      ? scrim && { our: scrim.our, opp: scrim.opp, res: scrimResult(scrim)! }
      : ts.result === "BYE" || ts.our === null || ts.opp === null
        ? null
        : { our: ts.our, opp: ts.opp, res: ts.result };
    selected = {
      ts,
      heading,
      games,
      score,
      empty: isScrim
        ? "No replays uploaded for this scrim yet. Player stats come from its replays."
        : ts.series.isForfeit
          ? "Forfeit: no games were played, so this series is left out of game stats."
          : "Bye: no match was played.",
      boards: ts.opponent
        ? [
            { team: p.team.name, res: "W" as const, rows: seriesScoreboard(p.ctx, ts.series.id, p.team.id) },
            { team: ts.opponent.shortName, res: "L" as const, rows: seriesScoreboard(p.ctx, ts.series.id, ts.opponent.id) },
          ]
        : [],
      // Head to head lives on the scouting page, which only lists this season's NSE opponents.
      oppSlug: ts.opponent && p.season.some((s) => s.opponent?.id === ts.opponent!.id) ? ts.opponent.slug : null,
    };
  }
  return { kind, title, dateLine, cards, result, selected };
}

export { nightSlugOf };
