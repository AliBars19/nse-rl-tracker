/**
 * Reads the property header of a Rocket League `.replay` file: start time, score, map and the
 * per-player scoreboard. The header sits at the front of the file as plain Unreal Engine 3
 * properties, so no network or ballchasing is needed and only the first few KB are read.
 *
 * Used by the admin Replays page to work out which series and game a file belongs to.
 * (Full stats still come from ballchasing; this is only for sorting.)
 */

export interface ReplayPlayer {
  name: string;
  /** 0 = blue, 1 = orange. */
  team: 0 | 1;
  score: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
}

export interface ReplayHeader {
  /** Unix seconds when the match started. */
  startedAt: number;
  team0Score: number;
  team1Score: number;
  mapName: string;
  teamSize: number;
  matchType: string;
  /** Name the lobby or the person saving the replay gave it, e.g. 'NSEMD1G2' (NSE match day 1, round 2). */
  replayName: string;
  seconds: number;
  players: ReplayPlayer[];
}

type Value = number | string | boolean | Props | Props[];
interface Props {
  [key: string]: Value;
}

const MAX_STRING = 4096;
const MAX_ITEMS = 4096;
const MAX_DEPTH = 8;

class Reader {
  private view: DataView;
  pos = 0;
  constructor(private bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  private need(n: number) {
    if (this.pos + n > this.bytes.length) throw new Error("Not a Rocket League replay (file ends early)");
  }
  i32(): number {
    this.need(4);
    const v = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return v;
  }
  f32(): number {
    this.need(4);
    const v = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return v;
  }
  i64(): number {
    this.need(8);
    const v = Number(this.view.getBigInt64(this.pos, true));
    this.pos += 8;
    return v;
  }
  u8(): number {
    this.need(1);
    return this.bytes[this.pos++];
  }
  /** Length-prefixed string: positive = Latin-1, negative = UTF-16LE, both NUL-terminated. */
  str(): string {
    const n = this.i32();
    if (n === 0) return "";
    const chars = Math.abs(n);
    if (chars > MAX_STRING) throw new Error("Not a Rocket League replay (bad string)");
    const width = n < 0 ? 2 : 1;
    this.need(chars * width);
    const raw = this.bytes.subarray(this.pos, this.pos + (chars - 1) * width);
    this.pos += chars * width;
    return new TextDecoder(n < 0 ? "utf-16le" : "latin1").decode(raw);
  }
}

function props(r: Reader, depth = 0): Props {
  if (depth > MAX_DEPTH) throw new Error("Not a Rocket League replay (nesting too deep)");
  const out: Props = {};
  for (;;) {
    const name = r.str();
    if (name === "None" || name === "") return out;
    const type = r.str();
    r.i64(); // value size + array index; we parse by type instead
    switch (type) {
      case "IntProperty":
        out[name] = r.i32();
        break;
      case "FloatProperty":
        out[name] = r.f32();
        break;
      case "NameProperty":
      case "StrProperty":
        out[name] = r.str();
        break;
      case "BoolProperty":
        out[name] = r.u8() !== 0;
        break;
      case "QWordProperty":
        out[name] = r.i64();
        break;
      case "ByteProperty": {
        // An enum name followed by the enum value, or "None" followed by one raw byte.
        const kind = r.str();
        out[name] = kind === "None" ? r.u8() : r.str();
        break;
      }
      case "StructProperty":
        r.str(); // struct type name
        out[name] = props(r, depth + 1);
        break;
      case "ArrayProperty": {
        const n = r.i32();
        if (n < 0 || n > MAX_ITEMS) throw new Error("Not a Rocket League replay (bad array)");
        out[name] = Array.from({ length: n }, () => props(r, depth + 1));
        break;
      }
      default:
        throw new Error(`Unsupported replay property type ${type}`);
    }
  }
}

const num = (v: Value | undefined, fallback = 0) => (typeof v === "number" ? v : fallback);
const text = (v: Value | undefined) => (typeof v === "string" ? v : "");

/** Parse a replay from its first bytes (the header). Throws if it is not a replay. */
export function parseReplayHeader(bytes: Uint8Array): ReplayHeader {
  const r = new Reader(bytes);
  let p: Props;
  try {
    r.i32(); // header size
    r.i32(); // CRC
    const major = r.i32();
    const minor = r.i32();
    if (major >= 868 && minor >= 18) r.i32(); // net version
    if (!r.str().startsWith("TAGame.Replay")) throw new Error("not a replay");
    p = props(r);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    throw new Error(/^(Unsupported|Not a Rocket League)/.test(msg) ? msg : "Not a Rocket League replay");
  }
  const stats = Array.isArray(p.PlayerStats) ? p.PlayerStats : [];
  return {
    startedAt: num(p.MatchStartEpoch),
    // The game leaves a team's score out when it is 0.
    team0Score: num(p.Team0Score),
    team1Score: num(p.Team1Score),
    mapName: text(p.MapName),
    teamSize: num(p.TeamSize),
    matchType: text(p.MatchType),
    replayName: text(p.ReplayName),
    seconds: num(p.TotalSecondsPlayed),
    // Spectators (the person hosting a private lobby) are listed with Team -1: not players.
    players: stats
      .filter((s) => num(s.Team, -1) === 0 || num(s.Team, -1) === 1)
      .map((s) => ({
        name: text(s.Name),
        team: num(s.Team) === 1 ? (1 as const) : (0 as const),
        score: num(s.Score),
        goals: num(s.Goals),
        assists: num(s.Assists),
        saves: num(s.Saves),
        shots: num(s.Shots),
      })),
  };
}

/** Read just the header of a File/Blob (a few KB of a ~2 MB replay). */
export async function readReplayHeader(file: Blob): Promise<ReplayHeader> {
  const head = new DataView(await file.slice(0, 8).arrayBuffer());
  if (head.byteLength < 8) throw new Error("Not a Rocket League replay");
  const size = head.getInt32(0, true);
  if (size <= 0 || size > 1_000_000) throw new Error("Not a Rocket League replay");
  return parseReplayHeader(new Uint8Array(await file.slice(0, 8 + size).arrayBuffer()));
}
