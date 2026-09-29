import { describe, expect, it } from "vitest";
import { loadSeed } from "@/lib/data/seed";
import { ctxOf, ourTeam } from "./context";
import { nightsForSeason, teamNight } from "./nights";

const ds = loadSeed("spring-26")!;
const ctx = ctxOf(ds);
const champions = ourTeam(ds, "champions")!;
const commanders = ourTeam(ds, "commanders")!;

describe("City Champions league nights (seed)", () => {
  const nights = nightsForSeason(ctx, champions.team.id, "div2");

  it("covers Weeks 3–6 of Division 2 only (not Swiss Stage 1)", () => {
    expect(nights.map((n) => n.night.label)).toEqual(["Week 3", "Week 4", "Week 5", "Week 6"]);
    expect(nights.every((n) => n.tier === "div2")).toBe(true);
  });

  it("scores 4, 6, 4, 6 from the engine and agrees with the sheet", () => {
    expect(nights.map((n) => n.points)).toEqual([4, 6, 4, 6]);
    expect(nights.every((n) => n.pointsSource === "engine" && !n.mismatch)).toBe(true);
  });

  it("labels rounds like the approved design", () => {
    expect(nights[0].rounds.map((r) => [r.label, r.ts.opponent?.shortName, r.ts.result, `${r.ts.our}–${r.ts.opp}`])).toEqual([
      ["Opener", "Lincoln Swans", "L", "1–3"],
      ["Losers’ match", "UCL Huzzlingtons", "W", "3–2"],
      ["1–1 decider", "Royal Bears", "L", "1–3"],
    ]);
    expect(nights[1].rounds[2]).toMatchObject({ label: "1–1 decider" });
    expect(nights[1].rounds[2].ts.series.isForfeit).toBe(true);
    expect(nights.map((n) => n.path)).toEqual([
      "1–1, lost decider",
      "1–1, won decider",
      "1–1, lost decider",
      "1–1, won decider",
    ]);
  });
});

describe("City Commanders nights (seed)", () => {
  const nights = nightsForSeason(ctx, commanders.team.id, "swiss");

  it("includes Swiss Stage 1 and Weeks 3–6", () => {
    expect(nights.map((n) => n.night.label)).toEqual(["Stage 1", "Week 3", "Week 4", "Week 5", "Week 6"]);
    expect(nights[0].rounds).toHaveLength(6);
  });

  it("takes points from the sheet (Swiss ladder unconfirmed): 8 every time, 40 total", () => {
    expect(nights.map((n) => n.points)).toEqual([8, 8, 8, 8, 8]);
    expect(nights.every((n) => n.pointsSource === "sheet")).toBe(true);
  });

  it("marks the two 1–0 wins as forfeits", () => {
    const forfeits = nights.flatMap((n) => n.rounds).filter((r) => r.ts.series.isForfeit);
    expect(forfeits.map((r) => r.ts.opponent?.name)).toEqual(["Leic is More", "Brighton Pandas"]);
  });
});

describe("engine vs sheet, every Division 2 team", () => {
  it("agrees for every team that played all three rounds, except known sheet anomalies", () => {
    const mismatches: string[] = [];
    let checked = 0;
    for (const night of ds.nights.filter((n) => n.tier === "div2")) {
      const teamIds = new Set(
        ds.series.filter((s) => s.nightId === night.id).flatMap((s) => [s.homeTeamId, s.awayTeamId]),
      );
      for (const id of teamIds) {
        if (!id) continue;
        const tn = teamNight(ctx, night, id);
        if (!tn?.computed || tn.sheet?.points == null) continue;
        checked++;
        if (tn.mismatch) mismatches.push(`${night.label} ${ctx.team(id).name}: engine ${tn.computed.points}, sheet ${tn.sheet.points}`);
      }
    }
    expect(checked).toBeGreaterThan(40);
    // Three teams lost Round 3 from 1–1 (ladder: 4) but the sheet gives 6. Every other 1–1 loser
    // got 4, so these look like NSE adjustments. They are listed here rather than hidden by the
    // engine; see docs/points-engine.md.
    expect(mismatches).toEqual([
      "Week 4 Fake Warwick: engine 4, sheet 6",
      "Week 5 Swansea Storm: engine 4, sheet 6",
      "Week 6 Lincoln Swans: engine 4, sheet 6",
    ]);
  });
});
