import { describe, expect, it } from "vitest";
import { parseReplayHeader } from "./header";

/** Minimal encoder for the property header of a Rocket League replay (UE3 serialisation). */
const bytes: number[] = [];
const out = () => Uint8Array.from(bytes);

function i32(n: number): number[] {
  const b = new DataView(new ArrayBuffer(4));
  b.setInt32(0, n, true);
  return [...new Uint8Array(b.buffer)];
}
function i64(n: number): number[] {
  const b = new DataView(new ArrayBuffer(8));
  b.setBigInt64(0, BigInt(n), true);
  return [...new Uint8Array(b.buffer)];
}
function f32(n: number): number[] {
  const b = new DataView(new ArrayBuffer(4));
  b.setFloat32(0, n, true);
  return [...new Uint8Array(b.buffer)];
}
function str(s: string): number[] {
  if (/^[\x00-\x7f]*$/.test(s)) return [...i32(s.length + 1), ...[...s].map((c) => c.charCodeAt(0)), 0];
  const units = [...s].flatMap((c) => [c.charCodeAt(0) & 0xff, c.charCodeAt(0) >> 8]);
  return [...i32(-(s.length + 1)), ...units, 0, 0];
}
/** name, type, size (ignored by the parser), array index, then the value bytes. */
const prop = (name: string, type: string, value: number[]) => [...str(name), ...str(type), ...i32(value.length), ...i32(0), ...value];
const int = (name: string, n: number) => prop(name, "IntProperty", i32(n));
const qword = (name: string, n: number) => prop(name, "QWordProperty", i64(n));
const float = (name: string, n: number) => prop(name, "FloatProperty", f32(n));
const name = (key: string, s: string) => prop(key, "NameProperty", str(s));
const text = (key: string, s: string) => prop(key, "StrProperty", str(s));
const bool = (key: string, v: boolean) => prop(key, "BoolProperty", [v ? 1 : 0]);
const NONE = str("None");
const array = (key: string, items: number[][]) => prop(key, "ArrayProperty", [...i32(items.length), ...items.flat()]);

function player(n: string, team: number, stats: { score: number; goals: number; assists: number; saves: number; shots: number }, platform: "steam" | "psn") {
  const id =
    platform === "steam"
      ? [...str("PlayerID"), ...str("StructProperty"), ...i64(0), ...str("UniqueNetId"), ...prop("Uid", "QWordProperty", i64(7)), ...prop("Platform", "ByteProperty", [...str("OnlinePlatform"), ...str("OnlinePlatform_Steam")]), ...NONE]
      : // PlayStation IDs carry a nested struct whose byte property has the enum name "None" and one raw byte.
        [...str("PlayerID"), ...str("StructProperty"), ...i64(0), ...str("UniqueNetId"), ...prop("Uid", "QWordProperty", i64(0)), ...prop("NpId", "StructProperty", [...str("SceNpId"), ...prop("Term", "ByteProperty", [...str("None"), 0]), ...NONE]), ...NONE];
  return [
    ...name("Name", n),
    ...id,
    ...int("Team", team),
    ...int("Score", stats.score),
    ...int("Goals", stats.goals),
    ...int("Assists", stats.assists),
    ...int("Saves", stats.saves),
    ...int("Shots", stats.shots),
    ...bool("bBot", false),
    ...NONE,
  ];
}

function replay(opts: { team0?: number; team1?: number; epoch?: number; name?: string; players: number[][] }): Uint8Array {
  bytes.length = 0;
  const body = [
    ...int("TeamSize", 3),
    ...bool("bMatchCreatorAdminEnabled", true),
    ...(opts.team0 ? int("Team0Score", opts.team0) : []),
    ...(opts.team1 ? int("Team1Score", opts.team1) : []),
    ...float("TotalSecondsPlayed", 301.5),
    ...qword("MatchStartEpoch", opts.epoch ?? 1792526617),
    ...name("MapName", "Paname_Dusk_P"),
    ...text("MatchType", "Private"),
    ...(opts.name ? text("ReplayName", opts.name) : []),
    ...array("Goals", [[...int("frame", 100), ...name("CarName", "Car_TA_1"), ...NONE]]),
    ...array("PlayerStats", opts.players),
    ...NONE,
  ];
  const head = [...i32(868), ...i32(34), ...i32(12), ...str("TAGame.Replay_Soccar_TA"), ...body];
  bytes.push(...i32(head.length + 4), ...i32(0), ...head);
  return out();
}

describe("parseReplayHeader", () => {
  const stats = { score: 300, goals: 1, assists: 0, saves: 2, shots: 3 };

  it("reads score, map, start time and players", () => {
    const h = parseReplayHeader(
      replay({ team0: 2, team1: 3, players: [player("kidwys", 0, stats, "steam"), player("Sols", 1, { ...stats, goals: 3 }, "steam")] }),
    );
    expect(h).toMatchObject({ team0Score: 2, team1Score: 3, mapName: "Paname_Dusk_P", teamSize: 3, matchType: "Private", startedAt: 1792526617 });
    expect(h.seconds).toBeCloseTo(301.5);
    expect(h.players).toEqual([
      { name: "kidwys", team: 0, score: 300, goals: 1, assists: 0, saves: 2, shots: 3 },
      { name: "Sols", team: 1, score: 300, goals: 3, assists: 0, saves: 2, shots: 3 },
    ]);
  });

  it("treats a missing score as 0 (the game omits zero scores)", () => {
    const h = parseReplayHeader(replay({ team0: 0, team1: 1, players: [player("a", 0, stats, "steam")] }));
    expect(h.team0Score).toBe(0);
    expect(h.team1Score).toBe(1);
  });

  it("copes with PlayStation player IDs and non-ASCII names", () => {
    const h = parseReplayHeader(replay({ team0: 1, players: [player("salt ナ", 1, stats, "psn"), player("kidwys", 0, stats, "steam")] }));
    expect(h.players.map((p) => p.name)).toEqual(["salt ナ", "kidwys"]);
  });

  it("leaves spectators out and reads the replay name", () => {
    const h = parseReplayHeader(
      replay({ team0: 1, name: "NSEMD1G2", players: [player("host", -1, { score: 0, goals: 0, assists: 0, saves: 0, shots: 0 }, "steam"), player("kidwys", 0, stats, "steam")] }),
    );
    expect(h.players.map((p) => p.name)).toEqual(["kidwys"]);
    expect(h.replayName).toBe("NSEMD1G2");
  });

  it("rejects files that are not replays", () => {
    expect(() => parseReplayHeader(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))).toThrow(/replay/i);
    expect(() => parseReplayHeader(new Uint8Array(0))).toThrow(/replay/i);
  });
});
