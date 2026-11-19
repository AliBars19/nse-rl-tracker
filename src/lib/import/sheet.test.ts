import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCell, parseStandingsSheet, SPRING_26_LAYOUTS } from "./sheet";

const csv = (name: string) => readFileSync(join(process.cwd(), "seed-data", "winter-26", name), "utf8");

describe("Winter 26 Stage 2 standings sheet (Weeks 3–5)", () => {
  it("reads the Division 1 tab: positions, weekly points, totals, and the teams that went down", () => {
    const rows = parseStandingsSheet(csv("stage2-division-1.csv"), SPRING_26_LAYOUTS.div1);
    expect(rows).toHaveLength(38);
    const champs = rows.find((r) => r.team === "City Champions")!;
    expect(champs).toMatchObject({ position: 23, total: 12, warnings: [] });
    expect(champs.cells.map((c) => [c.week, c.points])).toEqual([[3, 3], [4, 3], [5, 6], [6, null]]);
    expect(rows.find((r) => r.team === "Roehampton Esports")).toMatchObject({ position: 1, total: 40 });
    // a team promoted into Division 1 has no Week 3 points
    expect(rows.find((r) => r.team === "IC Trees of Green")!.cells[0]).toMatchObject({ points: null, status: "absent" });
    // teams that left have no position and a movement status
    const exe = rows.find((r) => r.team === "Exe-it Strategy")!;
    expect(exe.position).toBeNull();
    expect(exe.cells.map((c) => [c.week, c.points, c.status])).toEqual([[3, 3, "played"], [4, null, "relegated_out"], [5, null, "absent"], [6, null, "absent"]]);
    // every team's total is the sum of its weeks
    expect(rows.flatMap((r) => r.warnings)).toEqual([]);
  });

  it("reads the Swiss tab: Stage 1 is week 1, the total sits in the column after Week 6, and a bare 'Promoted' means the team left", () => {
    const rows = parseStandingsSheet(csv("stage2-swiss-top.csv"), SPRING_26_LAYOUTS.swiss);
    const commanders = rows.find((r) => r.team === "City Commanders")!;
    expect(commanders).toMatchObject({ position: 3, total: 38, warnings: [] });
    expect(commanders.cells.map((c) => [c.week, c.points])).toEqual([[1, 10], [3, 10], [4, 8], [5, 10], [6, null]]);
    const herts = rows.find((r) => r.team === "Herts RL Team 1")!;
    expect(herts.cells.map((c) => c.status)).toEqual(["played", "promoted_out", "played", "promoted_out", "absent"]);
  });

  it("treats a bare Promoted or Demoted as leaving the tab", () => {
    expect(parseCell("Promoted", "swiss", 4)).toMatchObject({ points: null, status: "promoted_out" });
    expect(parseCell("Demoted", "div1", 5)).toMatchObject({ points: null, status: "relegated_out" });
    expect(parseCell("Promoted to Div 1", "div2", 4).status).toBe("promoted_out");
    expect(parseCell("Promoted to Div 1", "div1", 4).status).toBe("promoted_in");
  });
});
