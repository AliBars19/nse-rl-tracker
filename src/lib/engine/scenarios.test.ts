import { describe, expect, it } from "vitest";
import { loadSeed } from "@/lib/data/seed";
import { ctxOf, ourTeam } from "./context";
import { scenarioPreview } from "./preview";
import { DIV2_LADDER, getRuleset } from "./rulesets";
import { buildScenarios } from "./scenarios";

// Handoff 5.3: Division 2 totals going into Week 6.
const PRE_WEEK_6 = [
  ["lincoln", "Lincoln Swans", 30],
  ["nottingham", "Nottingham", 30],
  ["trent", "Trent Thunders", 22],
  ["pompey", "Portsmouth Pending", 16],
  ["city", "City Champions", 14],
  ["chargers", "Chargers Green", 14],
  ["bears", "Royal Bears", 14],
  ["sussy", "Sussy Staffordians", 12],
  ["keele", "Keele Krakens 2nd", 8],
  ["womp", "Womp womp Leeds stomp stomp", 2],
].map(([teamId, name, total]) => ({ teamId: teamId as string, name: name as string, total: total as number }));

const div2 = getRuleset("spring-26", "div2");

describe("buildScenarios (pre-Week 6 Division 2)", () => {
  const s = buildScenarios({ ruleset: div2, table: PRE_WEEK_6, ourTeamId: "city", r1Opponent: "Trent Thunders" })!;

  it("describes where we stand going in", () => {
    expect(s.goingIn).toMatchObject({ total: 14, rank: 5, tied: true, text: "joint 5th · 14 pts" });
  });

  it("gives six outcomes with points, totals and effects", () => {
    expect(s.outcomes.map((o) => [o.plain, o.points, o.total, o.effectText])).toEqual([
      ["Win all three", 10, 24, "Promoted to Division 1"],
      ["Win R1 + R2, lose R3", 7, 21, "Stay in Division 2"],
      ["Split R1 + R2, win R3", 6, 20, "Stay in Division 2"],
      ["Split R1 + R2, lose R3", 4, 18, "Stay in Division 2"],
      ["Lose R1 + R2, win R3", 2, 16, "Stay in Division 2"],
      ["Lose all three", 0, 14, "Relegated to Swiss"],
    ]);
    expect(s.groups.map((g) => [g.title, g.outcomes.map((o) => o.label)])).toEqual([
      ["Go 2–0", ["Win Round 3", "Lose Round 3"]],
      ["Go 1–1", ["Win Round 3", "Lose Round 3"]],
      ["Go 0–2", ["Win Round 3", "Lose Round 3"]],
    ]);
  });

  it("headline names the Round 1 opponent and the promotion", () => {
    expect(s.headline).toEqual({ r1Opponent: "Trent Thunders", promotedTo: "Division 1", maxPoints: 10 });
  });

  it("lists rivals within reach, matching the approved mockup", () => {
    expect(s.rivals.map((r) => [r.name, r.total, r.gapText, r.note])).toEqual([
      ["Portsmouth Pending", 16, "+2 ahead", "Holds the last top-4 spot. Outscore them by 3+ to pass them."],
      ["Chargers Green", 14, "level", "Outscore them tonight to finish above."],
      ["Royal Bears", 14, "level", "Outscore them tonight to finish above."],
      ["Sussy Staffordians", 12, "2 behind", "They pass you only if they outscore you by 3+."],
      ["Keele Krakens 2nd", 8, "6 behind", "They pass you only if they outscore you by 7+."],
    ]);
  });

  it("never uses scoreline-like copy", () => {
    const text = JSON.stringify(s);
    expect(text).not.toMatch(/the [12]–0 match/i);
    expect(text).not.toMatch(/win the [012]–[012]/i);
  });

  it("says a gap is out of reach when the ladder cannot produce it", () => {
    const far = buildScenarios({
      ruleset: div2,
      table: [
        { teamId: "a", name: "A", total: 30 },
        { teamId: "us", name: "Us", total: 20 },
        { teamId: "b", name: "B", total: 9 },
      ],
      ourTeamId: "us",
      r1Opponent: null,
      rivalWindow: 20,
    })!;
    expect(far.rivals.map((r) => r.note)).toEqual(["Out of reach this week.", "Cannot pass you this week."]);
  });

  it("returns null for a tier without a ladder (Swiss)", () => {
    const swiss = getRuleset("spring-26", "swiss");
    expect(buildScenarios({ ruleset: swiss, table: PRE_WEEK_6, ourTeamId: "city", r1Opponent: null })).toBeNull();
  });

  it("uses the Division 2 ladder", () => {
    expect(div2.ladder).toEqual(DIV2_LADDER);
  });
});

describe("scenarioPreview (seed)", () => {
  const ds = loadSeed("spring-26")!;
  const ctx = ctxOf(ds);

  it("rebuilds the archived Week 6 preview for City Champions from the final table", () => {
    const champions = ourTeam(ds, "champions")!;
    const p = scenarioPreview(ctx, champions.team.id, "div2")!;
    expect(p).toMatchObject({ week: 6, weekLabel: "WEEK 6", archived: true, r1Opponent: "Trent Thunders" });
    expect(p.scenarios.goingIn.text).toBe("joint 5th · 14 pts");
    expect(p.scenarios.rivals.map((r) => [r.name, r.total])).toEqual([
      ["Portsmouth Pending", 16],
      ["Chargers Green", 14],
      ["Royal Bears", 14],
      ["Sussy Staffordians", 12],
      ["Keele Krakens 2nd", 8],
    ]);
  });

  it("has no preview for City Commanders while the Swiss ladder is unknown", () => {
    const commanders = ourTeam(ds, "commanders")!;
    expect(scenarioPreview(ctx, commanders.team.id, "swiss")).toBeNull();
  });
});
