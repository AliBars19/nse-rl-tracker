import { describe, expect, it } from "vitest";
import { detectColour, mapReplay, matchPlayer, type BcReplay } from "./map";

const replay: BcReplay = {
  id: "r1",
  status: "ok",
  overtime: true,
  blue: {
    color: "blue",
    stats: { core: { goals: 3 } },
    players: [
      { name: "Caprillix", id: { platform: "epic", id: "abc" }, stats: { core: { score: 540, goals: 2, assists: 0, saves: 3, shots: 4, mvp: true }, boost: { bpm: 400 } } },
      { name: "YamsRL", id: { platform: "steam", id: "7656" }, stats: { core: { score: 300, goals: 1, assists: 1, saves: 1, shots: 2, mvp: false } } },
      { name: "kid", stats: { core: { score: 200, goals: 0, assists: 2, saves: 0, shots: 1, mvp: false } } },
    ],
  },
  orange: {
    color: "orange",
    stats: { core: { goals: 2 } },
    players: [{ name: "Bear1", stats: { core: { score: 410, goals: 2, assists: 0, saves: 2, shots: 5, mvp: false } } }],
  },
};

const roster = [
  { id: "p-cap", nickname: "Caprillix", platformIds: null },
  { id: "p-yams", nickname: "Yams", platformIds: { steam: "7656" } },
  { id: "p-kid", nickname: "kid", platformIds: null },
];

describe("ballchasing mapping", () => {
  it("matches by platform id, then by exact nickname", () => {
    expect(matchPlayer(replay.blue!.players![1], roster)?.id).toBe("p-yams");
    expect(matchPlayer(replay.blue!.players![0], roster)?.id).toBe("p-cap");
    expect(matchPlayer({ name: "Stranger" }, roster)).toBeNull();
  });

  it("detects which colour we played", () => {
    expect(detectColour(replay, roster)).toBe("blue");
    expect(detectColour(replay, [])).toBeNull();
  });

  it("maps goals, overtime and core stats; keeps other stats in extra", () => {
    const g = mapReplay(replay, "orange", [], roster);
    expect([g.homeGoals, g.awayGoals, g.overtime]).toEqual([2, 3, true]);
    const cap = g.stats.find((s) => s.displayName === "Caprillix")!;
    expect(cap).toMatchObject({ side: "away", playerId: "p-cap", score: 540, goals: 2, saves: 3, shots: 4, mvp: true, platform: "epic" });
    expect(cap.extra).toEqual({ boost: { bpm: 400 } });
    expect(g.stats.find((s) => s.displayName === "Bear1")).toMatchObject({ side: "home", playerId: null });
  });
});
