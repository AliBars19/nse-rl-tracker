import { describe, expect, it } from "vitest";
import { lobbyRound, sortForTeams, sortReplays, type SortReplay, type SortSeries } from "./sort";

const T0 = Date.UTC(2026, 9, 20, 18, 11) / 1000; // Tue 20 Oct 2026, 19:11 UK (BST)

const OUR = ["kidwys", "stav1c", "yam.een"];
let n = 0;

/** One game: `us` scored first. Opponents are named so they differ between series. */
function game(us: number, them: number, opp: string, opts: { orange?: boolean; name?: string; at?: number; ours?: string[] } = {}): SortReplay {
  n += 1;
  const ours = (opts.ours ?? OUR).map((name) => ({ name, team: (opts.orange ? 1 : 0) as 0 | 1 }));
  const theirs = [1, 2, 3].map((i) => ({ name: `${opp}${i}`, team: (opts.orange ? 0 : 1) as 0 | 1 }));
  return {
    id: `r${n}`,
    startedAt: opts.at ?? T0 + n * 600,
    team0Score: opts.orange ? them : us,
    team1Score: opts.orange ? us : them,
    replayName: opts.name ?? "",
    players: [...ours, ...theirs],
  };
}

const series = (id: string, ours: number, theirs: number, extra: Partial<SortSeries> = {}): SortSeries => ({ id, label: id, date: "2026-10-20", round: null, ours, theirs, ...extra });

// Champions, Week 1: W 3–1, W 3–1, L 0–3 (11 games), as in the real upload.
const R1 = series("r1-ghosts", 3, 1, { round: 1 });
const R2 = series("r2-solent", 3, 1, { round: 2 });
const R3 = series("r3-durham", 0, 3, { round: 3 });

function champions(): SortReplay[] {
  n = 0;
  return [
    game(2, 3, "A", { name: "NSEMD1G1" }),
    game(4, 1, "A", { name: "NSEMD1G1" }),
    game(2, 1, "A", { name: "NSEMD1G1" }),
    game(1, 0, "A", { name: "NSEMD1G1" }),
    game(5, 1, "B", { name: "NSEMD1G2" }),
    game(2, 3, "B", { name: "NSEMD1G2" }),
    game(2, 1, "B", { name: "NSEMD1G2" }),
    game(3, 1, "B", { name: "NSEMD1G2" }),
    game(0, 3, "C", { name: "NSEMD1G3" }),
    game(1, 3, "C", { name: "NSEMD1G3" }),
    game(1, 2, "C", { name: "NSEMD1G3" }),
  ];
}

describe("lobbyRound", () => {
  it("reads the round from NSE lobby names", () => {
    expect(lobbyRound("NSEMD1G2")).toBe(2);
    expect(lobbyRound("nsemd4g3")).toBe(3);
    expect(lobbyRound("my replay")).toBeNull();
    expect(lobbyRound("")).toBeNull();
  });
});

describe("sortReplays", () => {
  it("puts a night's replays on the right series and game numbers", () => {
    const r = sortReplays(champions(), { key: "champions", rosterNames: [], series: [R1, R2, R3] });
    expect(r.matched).toBe(11);
    expect(r.placements.map((p) => [p.seriesId, p.gameNumber])).toEqual([
      ["r1-ghosts", 1], ["r1-ghosts", 2], ["r1-ghosts", 3], ["r1-ghosts", 4],
      ["r2-solent", 1], ["r2-solent", 2], ["r2-solent", 3], ["r2-solent", 4],
      ["r3-durham", 1], ["r3-durham", 2], ["r3-durham", 3],
    ]);
    expect(r.placements.every((p) => p.colour === "blue")).toBe(true);
    expect(r.placements.slice(0, 4).map((p) => p.won)).toEqual([false, true, true, true]);
  });

  it("works from file order alone: input order does not matter", () => {
    const shuffled = [...champions()].reverse();
    const r = sortReplays(shuffled, { key: "champions", rosterNames: [], series: [R1, R2, R3] });
    expect(r.matched).toBe(11);
    expect(r.placements[0]).toMatchObject({ seriesId: "r1-ghosts", gameNumber: 1 });
  });

  it("finds our side when we were orange (some games, or all)", () => {
    n = 0;
    // (opponents differ per game so only our side recurs)
    const games = [game(3, 0, "A", { orange: true }), game(1, 2, "B", { orange: false }), game(2, 0, "C", { orange: true })];
    const r = sortReplays(games, { key: "c", rosterNames: [], series: [series("s", 2, 1)] });
    expect(r.placements.map((p) => p.colour)).toEqual(["orange", "blue", "orange"]);
    expect(r.placements.map((p) => p.won)).toEqual([true, false, true]);
    expect(r.matched).toBe(3);
  });

  it("uses roster names for the colour when they match (even for one replay)", () => {
    n = 0;
    const g = game(3, 1, "A", { orange: true, ours: ["Caprillix", "Stavic", "Yameen"] });
    const r = sortReplays([g], { key: "c", rosterNames: ["caprillix", "Stavic"], series: [series("s", 1, 0)] });
    expect(r.placements[0]).toMatchObject({ colour: "orange", won: true, seriesId: "s", gameNumber: 1 });
  });

  it("recognises roster players despite leetspeak and punctuation (a single replay is enough)", () => {
    n = 0;
    const g = game(2, 1, "A", { orange: true });
    const r = sortReplays([g], { key: "c", rosterNames: ["Stavic", "Yameen", "Kid"], series: [series("s", 1, 0)] });
    expect(r.placements[0]).toMatchObject({ colour: "orange", won: true, seriesId: "s" });
  });

  it("leaves a series with no replays out instead of mis-filing the rest", () => {
    const all = champions();
    const noR2 = all.filter((g) => g.replayName !== "NSEMD1G2");
    const r = sortReplays(noR2, { key: "champions", rosterNames: [], series: [R1, R2, R3] });
    expect(r.matched).toBe(7);
    expect(new Set(r.placements.map((p) => p.seriesId))).toEqual(new Set(["r1-ghosts", "r3-durham"]));
  });

  it("uses the lobby name to choose between series with the same score", () => {
    n = 0;
    const games = [game(2, 0, "A", { name: "NSEMD1G2" }), game(2, 1, "A", { name: "NSEMD1G2" })];
    // only Round 2 was recorded, but Round 1 has the identical tally
    const a = series("round-1", 2, 0, { round: 1 });
    const b = series("round-2", 2, 0, { round: 2 });
    const r = sortReplays(games, { key: "c", rosterNames: ["kidwys"], series: [a, b] });
    expect(r.placements.map((p) => p.seriesId)).toEqual(["round-2", "round-2"]);
  });

  it("leaves replays that fit nothing unassigned, with their result", () => {
    n = 0;
    const g = [game(1, 0, "A"), game(0, 1, "A"), game(1, 0, "A"), game(9, 0, "Z")];
    const r = sortReplays(g, { key: "c", rosterNames: [], series: [series("s", 2, 1)] });
    expect(r.matched).toBe(3);
    expect(r.placements[3]).toMatchObject({ seriesId: null, gameNumber: null });
  });

  it("only uses series from the replay's own (UK) day", () => {
    n = 0;
    const late = game(1, 0, "A", { at: Date.UTC(2026, 9, 20, 23, 30) / 1000 }); // 00:30 UK on the 21st
    const r = sortReplays([late], { key: "c", rosterNames: ["kidwys"], series: [series("tue", 1, 0), series("wed", 1, 0, { date: "2026-10-21" })] });
    expect(r.placements[0].seriesId).toBe("wed");
  });

  it("does not guess colour when nothing tells us", () => {
    n = 0;
    const r = sortReplays([game(1, 0, "A")], { key: "c", rosterNames: [], series: [series("s", 1, 0)] });
    expect(r.placements[0]).toMatchObject({ colour: null, seriesId: null });
  });
});

describe("partial uploads (a series that cannot be fitted by score)", () => {
  const champs = { key: "champions", rosterNames: ["Stavic", "Yameen"], series: [R1, R2, R3] };

  it("places a lone replay by its lobby round, marked as a guess", () => {
    n = 0;
    const r = sortReplays([game(2, 1, "A", { name: "NSEMD1G2" })], champs);
    expect(r.placements[0]).toMatchObject({ seriesId: "r2-solent", gameNumber: 1, colour: "blue", won: true, guess: true });
    expect(r.matched).toBe(0);
    expect(r.guessed).toBe(1);
  });

  it("numbers several partial replays in match order", () => {
    n = 0;
    const r = sortReplays([game(1, 2, "A", { name: "NSEMD1G3" }), game(0, 1, "A", { name: "NSEMD1G3" })], champs);
    expect(r.placements.map((p) => [p.seriesId, p.gameNumber, p.guess])).toEqual([["r3-durham", 1, true], ["r3-durham", 2, true]]);
  });

  it("does not guess without a lobby round, or when two series share it", () => {
    n = 0;
    const none = sortReplays([game(2, 1, "A")], champs);
    expect(none.placements[0]).toMatchObject({ seriesId: null, colour: "blue" });
    const twin = sortReplays([game(2, 1, "A", { name: "NSEMD1G1" })], { ...champs, series: [R1, { ...R1, id: "dup" }] });
    expect(twin.placements[0].seriesId).toBeNull();
  });

  it("never overrides a series fitted by score", () => {
    const r = sortReplays(champions(), champs);
    expect(r.placements.some((p) => p.guess)).toBe(false);
    expect(r.guessed).toBe(0);
  });

  it("sortForTeams picks the team by roster evidence when no score fits", () => {
    n = 0;
    const cmd = { key: "commanders", rosterNames: ["Junxi", "SafRL"], series: [series("cmd-r1", 1, 3, { round: 1 })] };
    const r = sortForTeams([game(2, 1, "A", { name: "NSEMD1G1" })], [cmd, champs]);
    expect(r.teamKey).toBe("champions");
    expect(r.result?.placements[0]).toMatchObject({ seriesId: "r1-ghosts", guess: true });
  });
});

describe("sortForTeams", () => {
  // Commanders, Week 1: L 1–3, L 0–3, W 3–1: same 11 games, different tallies.
  const C1 = series("cmd-r1", 1, 3, { round: 1 });
  const C2 = series("cmd-r2", 0, 3, { round: 2 });
  const C3 = series("cmd-r3", 3, 1, { round: 3 });

  it("picks the team whose results fit", () => {
    const teams = [
      { key: "commanders", rosterNames: [], series: [C1, C2, C3] },
      { key: "champions", rosterNames: [], series: [R1, R2, R3] },
    ];
    const r = sortForTeams(champions(), teams);
    expect(r.teamKey).toBe("champions");
    expect(r.result?.matched).toBe(11);
  });

  it("says so when it cannot tell (both teams fit equally)", () => {
    const teams = [
      { key: "a", rosterNames: [], series: [R1, R2, R3] },
      { key: "b", rosterNames: [], series: [{ ...R1, id: "b1" }, { ...R2, id: "b2" }, { ...R3, id: "b3" }] },
    ];
    expect(sortForTeams(champions(), teams).teamKey).toBeNull();
  });

  it("says so when nothing fits", () => {
    const teams = [{ key: "a", rosterNames: [], series: [series("x", 5, 5)] }];
    expect(sortForTeams(champions(), teams).teamKey).toBeNull();
  });
});
