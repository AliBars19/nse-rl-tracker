import { describe, expect, it } from "vitest";
import { qualification, type Stage1Result } from "./qualification";

const RULES = { rounds: 6, winsForDiv1: 4 };
const r = (round: number, won: boolean): Stage1Result => ({ round, opponent: `Opp ${round}`, won, score: won ? "3–1" : "1–3" });

describe("Stage 1 qualification (4 wins from 6 rounds for Div 1)", () => {
  it("Champions after Week 1: 2–1, needs 2 of the last 3", () => {
    const q = qualification([r(1, true), r(2, true), r(3, false)], RULES);
    expect(q).toMatchObject({ wins: 2, losses: 1, remaining: 3, needed: 2, status: "alive" });
    expect(q.headline).toBe("Need 2 more wins");
    expect(q.detail).toBe("Win 2 of the last 3 rounds");
  });

  it("Commanders after Week 1: 1–2, must win all three", () => {
    const q = qualification([r(1, false), r(2, false), r(3, true)], RULES);
    expect(q).toMatchObject({ wins: 1, remaining: 3, needed: 3, status: "alive" });
    expect(q.detail).toBe("Win all three rounds");
  });

  it("3–0 needs just one more", () => {
    const q = qualification([r(1, true), r(2, true), r(3, true)], RULES);
    expect(q.headline).toBe("Need 1 more win");
    expect(q.detail).toBe("Win 1 of the last 3 rounds");
  });

  it("is qualified once it has four wins, whatever is left", () => {
    const q = qualification([1, 2, 3, 4].map((n) => r(n, true)), RULES);
    expect(q.status).toBe("qualified");
    expect(q.headline).toBe("Div 1 secured");
  });

  it("is out when the wins needed exceed the rounds left", () => {
    expect(qualification([r(1, false), r(2, false), r(3, false)], RULES).status).toBe("out"); // needs 4, 3 left
    const late = qualification([r(1, true), r(2, true), r(3, false), r(4, false), r(5, false)], RULES); // needs 2, 1 left
    expect(late.status).toBe("out");
    expect(late.headline).toBe("Swiss");
    expect(late.detail).toBe("Can't reach 4 wins: 2 won, 1 round left");
    const done = qualification([r(1, false), r(2, true), r(3, true), r(4, false), r(5, false), r(6, false)], RULES);
    expect(done.detail).toBe("Finished on 2 wins, short of 4");
  });

  it("copes with the last round and with two left", () => {
    const one = qualification([r(1, true), r(2, true), r(3, true), r(4, false), r(5, false)], RULES); // 3–2: needs 1, 1 left
    expect(one).toMatchObject({ status: "alive", needed: 1, remaining: 1 });
    expect(one.detail).toBe("Win the last round");
    const two = qualification([r(1, true), r(2, true), r(3, false), r(4, false)], RULES); // 2–2: needs 2, 2 left
    expect(two.detail).toBe("Win both remaining rounds");
  });

  it("lays the six rounds out in order, leaving unplayed ones empty", () => {
    const q = qualification([r(3, false), r(1, true)], RULES);
    expect(q.rounds.map((x) => x.round)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(q.rounds.map((x) => (x.result ? (x.result.won ? "W" : "L") : "-"))).toEqual(["W", "-", "L", "-", "-", "-"]);
  });

  it("with nothing played yet, needs four from six", () => {
    const q = qualification([], RULES);
    expect(q).toMatchObject({ played: 0, needed: 4, remaining: 6, status: "alive" });
    expect(q.detail).toBe("Win 4 of the 6 rounds");
  });
});
