import "server-only";
import type { TeamSeries } from "@/lib/engine/context";
import { seriesScoreboard } from "@/lib/engine/players";
import { nightSlugOf } from "@/lib/engine/scouting";
import { PLAYOFF_ROUND_NAMES } from "@/lib/engine/stats";
import { longDate } from "./dashboard";
import type { TeamPage } from "./team";

export interface NightTab {
  slug: string;
  label: string; // 'WK 3' | 'STG 1' | 'PLAYOFFS'
}

export function nightTabs(p: TeamPage): NightTab[] {
  const tabs: NightTab[] = p.nights.map((n) => ({
    slug: n.night.stage === "placement" ? "stage-1" : `week-${n.night.week}`,
    label: n.night.stage === "placement" ? "STG 1" : `WK ${n.night.week}`,
  }));
  if (p.season.some((s) => s.series.stage === "playoff")) tabs.push({ slug: "playoffs", label: "PLAYOFFS" });
  return tabs;
}

/** Default night for /matches: the latest league night (as in the approved design). */
export function defaultNightSlug(p: TeamPage): string | null {
  const tabs = nightTabs(p).filter((t) => t.slug !== "playoffs");
  return tabs.at(-1)?.slug ?? (nightTabs(p)[0]?.slug ?? null);
}

export interface PathCard {
  ts: TeamSeries;
  title: string; // 'ROUND 3 · 1–1 DECIDER'
  opp: string;
  score: string;
  res: "W" | "L" | "BYE";
  after: string | null; // 'Record after: 2–1'
  focused: boolean;
}

export interface MatchesView {
  title: string;
  dateLine: string;
  cards: PathCard[];
  result: { big: string; label: string; caption: string };
  selected: {
    ts: TeamSeries;
    heading: string;
    games: Array<{ n: number; our: number | null; opp: number | null; overtime: boolean; processed: boolean }>;
    boards: Array<{ team: string; res: "W" | "L"; rows: ReturnType<typeof seriesScoreboard> }>;
    oppSlug: string | null;
  } | null;
}

export function buildMatches(p: TeamPage, slug: string, seriesId: string | null): MatchesView | null {
  let cards: PathCard[];
  let title: string;
  let dateLine: string;
  let result: MatchesView["result"];

  if (slug === "playoffs") {
    const po = p.season.filter((s) => s.series.stage === "playoff");
    if (!po.length) return null;
    cards = po.map((ts) => ({
      ts,
      title: (ts.series.playoffRound ? PLAYOFF_ROUND_NAMES[ts.series.playoffRound] : "Playoffs").toUpperCase(),
      opp: ts.opponent?.shortName ?? "Bye",
      score: ts.result === "BYE" ? "BYE" : `${ts.our}–${ts.opp}`,
      res: ts.result,
      after: ts.result === "BYE" ? "Seeded through" : ts.result === "W" ? "Through" : "Eliminated",
      focused: false,
    }));
    const last = po.at(-1)!;
    const lastRound = last.series.playoffRound ? PLAYOFF_ROUND_NAMES[last.series.playoffRound] : "playoffs";
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
      after: `Record after: ${r.recordAfter.w}–${r.recordAfter.l}`,
      focused: false,
    }));
    title = tn.night.label;
    const dates = [...new Set(tn.rounds.map((r) => r.ts.series.playedAt?.slice(0, 10)).filter(Boolean))] as string[];
    dateLine = [(dates.length ? dates : [tn.night.date]).map(longDate).join(" & "), tn.night.venue].filter(Boolean).join(" · ");
    result = { big: tn.points === null ? "—" : `+${tn.points}`, label: "NIGHT RESULT", caption: tn.path };
  }

  const focus = cards.find((c) => c.ts.series.id === seriesId) ?? [...cards].reverse().find((c) => c.res !== "BYE") ?? cards.at(-1)!;
  focus.focused = true;

  const ts = focus.ts;
  let selected: MatchesView["selected"] = null;
  if (ts) {
    const bo = `BEST OF ${ts.series.bestOf}`;
    const heading = [focus.title, ts.series.isForfeit ? "FORFEIT" : ts.result === "BYE" ? null : bo].filter(Boolean).join(" · ");
    const played = ts.series.isForfeit || ts.result === "BYE" ? 0 : (ts.our ?? 0) + (ts.opp ?? 0);
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
    selected = {
      ts,
      heading,
      games,
      boards: ts.opponent
        ? [
            { team: p.team.name, res: "W" as const, rows: seriesScoreboard(p.ctx, ts.series.id, p.team.id) },
            { team: ts.opponent.shortName, res: "L" as const, rows: seriesScoreboard(p.ctx, ts.series.id, ts.opponent.id) },
          ]
        : [],
      oppSlug: ts.opponent?.slug ?? null,
    };
  }
  return { title, dateLine, cards, result, selected };
}

export { nightSlugOf };
