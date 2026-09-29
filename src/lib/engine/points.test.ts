import { describe, expect, it } from "vitest";
import { bracketOf, describePath, nightPoints, roundLabel, type RoundResult } from "./points";
import { DIV2_LADDER } from "./rulesets";

/**
 * Handoff section 5.5: Division 2, Weeks 3 and 4 of Spring 26, written as match lists.
 * 'A 1-3 B' = A scored 1, B scored 3. 'A bye' = Round 3 bye for A.
 */
const WEEK_3 = {
  r1: [
    "City 1-3 Lincoln", "My Poor Decals 0-3 White Rose", "Sussy 0-3 Essex", "Swansea 2-3 Keele 2nd",
    "Portsmouth Pending 1-3 Megalodon", "Fake Warwick 1-3 BU", "No WiFi 2-3 Nottthemainteam", "UCL 0-3 Royal Bears",
  ],
  r2: [
    "Lincoln 3-1 Royal Bears", "White Rose 3-2 Nottthemainteam", "Essex 0-3 BU", "Keele 2nd 0-3 Megalodon",
    "UCL 2-3 City", "No WiFi 3-2 My Poor Decals", "Fake Warwick 3-0 Sussy", "Portsmouth Pending 3-1 Swansea",
  ],
  r3: [
    "Lincoln bye", "White Rose bye", "BU bye", "Megalodon bye",
    "Keele 2nd 0-3 Fake Warwick", "Essex 3-1 No WiFi", "Nottthemainteam 3-1 Portsmouth Pending",
    "Royal Bears 3-1 City", "Swansea 3-1 UCL", "Sussy 3-2 My Poor Decals",
  ],
};

const WEEK_4 = {
  r1: [
    "UoBraindead 0-1 Chargers", "RLExe 3-0 The Cabin", "Trent 1-3 Sussy", "Nottingham 3-0 Swansea",
    "Royal Bears 3-2 Keele 2nd", "Nottthemainteam 3-1 No WiFi", "Essex 2-3 Portsmouth Pending", "Fake Warwick 2-3 City",
  ],
  r2: [
    "Chargers 3-2 City", "RLExe 3-2 Portsmouth Pending", "Sussy 0-3 Nottthemainteam", "Nottingham 3-1 Royal Bears",
    "Fake Warwick 1-0 UoBraindead", "Essex 3-0 The Cabin", "No WiFi 0-3 Trent", "Keele 2nd 0-3 Swansea",
  ],
  r3: [
    "Chargers 1-3 Nottingham", "RLExe 3-0 Nottthemainteam", "Royal Bears 0-1 Trent", "Sussy 0-3 Essex",
    "Portsmouth Pending 3-0 Swansea", "City 1-0 Fake Warwick", "Keele 2nd 1-0 UoBraindead", "No WiFi 3-2 The Cabin",
  ],
};

function resultsByTeam(night: { r1: string[]; r2: string[]; r3: string[] }) {
  const out = new Map<string, RoundResult[]>();
  (["r1", "r2", "r3"] as const).forEach((round, i) => {
    for (const m of night[round]) {
      const bye = m.match(/^(.+) bye$/);
      if (bye) {
        out.set(bye[1], [...(out.get(bye[1]) ?? []), "BYE"]);
        continue;
      }
      const g = m.match(/^(.+) (\d+)-(\d+) (.+)$/);
      if (!g) throw new Error(m);
      const [, a, sa, sb, b] = g;
      const aWon = Number(sa) > Number(sb);
      for (const [team, won] of [[a, aWon], [b, !aWon]] as const) {
        const list = out.get(team) ?? [];
        list[i] = won ? "W" : "L";
        out.set(team, list);
      }
    }
  });
  return out;
}

function pointsFor(night: { r1: string[]; r2: string[]; r3: string[] }) {
  const pts: Record<string, number> = {};
  for (const [team, [r1, r2, r3]] of resultsByTeam(night)) {
    pts[team] = nightPoints(r1, r2, r3, DIV2_LADDER).points;
  }
  return pts;
}

describe("nightPoints: Division 2 ladder", () => {
  it("scores all six paths", () => {
    expect(nightPoints("W", "W", "W", DIV2_LADDER).points).toBe(10);
    expect(nightPoints("W", "W", "L", DIV2_LADDER).points).toBe(7);
    expect(nightPoints("W", "L", "W", DIV2_LADDER).points).toBe(6);
    expect(nightPoints("L", "W", "W", DIV2_LADDER).points).toBe(6);
    expect(nightPoints("W", "L", "L", DIV2_LADDER).points).toBe(4);
    expect(nightPoints("L", "W", "L", DIV2_LADDER).points).toBe(4);
    expect(nightPoints("L", "L", "W", DIV2_LADDER).points).toBe(2);
    expect(nightPoints("L", "L", "L", DIV2_LADDER).points).toBe(0);
  });

  it("flags promotion and relegation", () => {
    expect(nightPoints("W", "W", "W", DIV2_LADDER)).toMatchObject({ promoted: true, relegated: false });
    expect(nightPoints("L", "L", "L", DIV2_LADDER)).toMatchObject({ promoted: false, relegated: true });
    expect(nightPoints("W", "L", "L", DIV2_LADDER)).toMatchObject({ promoted: false, relegated: false });
  });

  it("scores a Round 3 bye for a 2–0 team as the promotion outcome (Week 3 exception)", () => {
    const p = nightPoints("W", "W", "BYE", DIV2_LADDER);
    expect(p).toMatchObject({ points: 10, promoted: true, r3Bye: true, path: "2–0, Round 3 bye" });
  });

  it("describes paths in plain words", () => {
    expect(nightPoints("L", "W", "L", DIV2_LADDER).path).toBe("1–1, lost decider");
    expect(nightPoints("W", "L", "W", DIV2_LADDER).path).toBe("1–1, won decider");
    expect(describePath("2-0", "L")).toBe("2–0, lost promotion match");
    expect(describePath("0-2", "W")).toBe("0–2, won relegation match");
  });

  it("matches the handoff's Week 3 expected points", () => {
    expect(pointsFor(WEEK_3)).toMatchObject({
      "Royal Bears": 6, "Fake Warwick": 6, Essex: 6, Nottthemainteam: 6,
      City: 4, "Keele 2nd": 4, "No WiFi": 4, "Portsmouth Pending": 4,
      Swansea: 2, Sussy: 2, UCL: 0, "My Poor Decals": 0,
      Lincoln: 10, "White Rose": 10, BU: 10, Megalodon: 10,
    });
  });

  it("matches the handoff's Week 4 expected points (forfeits count as wins)", () => {
    expect(pointsFor(WEEK_4)).toMatchObject({
      Nottingham: 10, RLExe: 10, Chargers: 7, Nottthemainteam: 7, City: 6, "Royal Bears": 4,
    });
  });

  it("gives City Champions 4, 6, 4, 6 across Weeks 3–6", () => {
    const nights: RoundResult[][] = [
      ["L", "W", "L"],
      ["W", "L", "W"],
      ["L", "W", "L"],
      ["W", "L", "W"],
    ];
    const pts = nights.map(([a, b, c]) => nightPoints(a, b, c, DIV2_LADDER).points);
    expect(pts).toEqual([4, 6, 4, 6]);
    expect(pts.reduce((s, p) => s + p, 0)).toBe(20);
  });
});

describe("bracketOf / roundLabel", () => {
  it("treats a bye as a win", () => {
    expect(bracketOf("BYE", "W")).toBe("2-0");
    expect(bracketOf("L", "BYE")).toBe("1-1");
  });

  it("labels rounds from the record going in", () => {
    expect(roundLabel(1, { w: 0, l: 0 }, "bracket")).toBe("Opener");
    expect(roundLabel(2, { w: 1, l: 0 }, "bracket")).toBe("Winners’ match");
    expect(roundLabel(2, { w: 0, l: 1 }, "bracket")).toBe("Losers’ match");
    expect(roundLabel(3, { w: 2, l: 0 }, "bracket")).toBe("Promotion match");
    expect(roundLabel(3, { w: 1, l: 1 }, "bracket")).toBe("1–1 decider");
    expect(roundLabel(3, { w: 0, l: 2 }, "bracket")).toBe("Relegation match");
    expect(roundLabel(4, { w: 3, l: 0 }, "swiss")).toBe("Promotion match");
    expect(roundLabel(5, { w: 2, l: 2 }, "swiss", "placement")).toBe("Round 5");
  });
});
