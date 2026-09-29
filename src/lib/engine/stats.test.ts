import { describe, expect, it } from "vitest";
import { loadSeed } from "@/lib/data/seed";
import { ctxOf, ourTeam, seasonSeries } from "./context";
import { nightsForSeason } from "./nights";
import { headToHead, meetingsWith, opponentList, patterns, theirSeason } from "./scouting";
import { form, fmtRecord, ordinal, playoffSummary, seasonStats } from "./stats";
import { standingsTable } from "./standings";

const ds = loadSeed("spring-26")!;
const ctx = ctxOf(ds);
const champs = ourTeam(ds, "champions")!;
const season = seasonSeries(ctx, champs.team.id, "div2");
const nights = nightsForSeason(ctx, champs.team.id, "div2");

describe("City Champions derived stats (handoff 5.2)", () => {
  const s = seasonStats(season, nights);

  it("series 6–7 including one forfeit win", () => {
    expect(fmtRecord(s.series)).toBe("6–7");
    expect(s.series.forfeitWins).toBe(1);
  });

  it("games 25–30 with the forfeit excluded and the playoff 2–4 included", () => {
    expect(fmtRecord(s.games)).toBe("25–30");
  });

  it("Game 5s 4–2", () => {
    expect(fmtRecord(s.deciders)).toBe("4–2");
  });

  it("5.0 points per night, best 6, worst 4", () => {
    expect(s.nights).toEqual({ count: 4, total: 20, avg: 5, best: 6, worst: 4 });
  });

  it("form: last five, newest first, playoffs included", () => {
    expect(form(season).map((f) => `${f.result} ${f.our}–${f.opp} ${f.opponent?.shortName}`)).toEqual([
      "L 2–4 Portsmouth Pirates",
      "W 3–2 Royal Bears",
      "L 1–3 Nottthemainteam",
      "W 3–2 Trent Thunders",
      "L 2–3 Sussy Staffordians",
    ]);
  });

  it("summarises the playoffs", () => {
    expect(playoffSummary(season)).toBe("Round 1 bye, lost Last 16 2–4 to Portsmouth Pirates");
  });
});

describe("Division 2 standings (sheet)", () => {
  const t = standingsTable(ctx, "div2");
  it("has the 16 final teams in NSE order with City 6th on 20", () => {
    expect(t.rows).toHaveLength(16);
    const city = t.rows.find((r) => r.isOurs)!;
    expect([city.position, city.total, city.playoffNote]).toEqual([6, 20, "Bye Round 1"]);
    expect(t.rows[4].team.name).toBe("Chargers Green");
    expect(t.rows[4].cells[3]).toEqual({ points: null, status: "promoted_in" });
  });
  it("uses WK labels", () => {
    expect(t.weeks.map((w) => w.label)).toEqual(["WK 3", "WK 4", "WK 5", "WK 6"]);
    expect(standingsTable(ctx, "swiss").weeks.map((w) => w.label)).toEqual(["STG 1", "WK 3", "WK 4", "WK 5", "WK 6"]);
  });
  it("puts City Commanders 8th of 55 in the Swiss table on 40", () => {
    const swiss = standingsTable(ctx, "swiss");
    expect(swiss.rows).toHaveLength(55);
    expect(swiss.rows.find((r) => r.isOurs)).toMatchObject({ position: 8, total: 40 });
  });
  it("ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 55].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "55th",
    ]);
  });
});

describe("Scouting (handoff 5.2 head-to-head)", () => {
  const opps = opponentList(season);

  it("lists 10 opponents sorted by meetings, then first meeting", () => {
    expect(opps.map((o) => [o.team.shortName, o.meta, `${o.w}–${o.l}`])).toEqual([
      ["Royal Bears", "3 meetings", "1–2"],
      ["Fake Warwick", "2 meetings · 1 forfeit", "2–0"],
      ["Lincoln Swans", "1 meeting", "0–1"],
      ["UCL Huzzlingtons", "1 meeting", "1–0"],
      ["Chargers Green", "1 meeting", "0–1"],
      ["Keele Krakens 2nd", "1 meeting", "1–0"],
      ["Sussy Staffordians", "1 meeting", "0–1"],
      ["Trent Thunders", "1 meeting", "1–0"],
      ["Nottthemainteam", "1 meeting", "0–1"],
      ["Portsmouth Pirates", "1 meeting · playoffs", "0–1"],
    ]);
  });

  const bears = opps[0];

  it("Royal Bears: series 1–2, games 5–8", () => {
    const h = headToHead(bears.meetings);
    expect(h.series).toEqual({ w: 1, l: 2 });
    expect(h.games).toEqual({ w: 5, l: 8 });
    expect(h.gamesPlayed).toBe(13);
  });

  it("describes each meeting's points effect", () => {
    expect(meetingsWith(ctx, season, bears.team.id).map((m) => [m.when, m.round, m.score, m.win, m.effect])).toEqual([
      ["WEEK 3 · 17 FEB", "Round 3 · 1–1 decider", "1–3", false, "Cost you 2 pts (6 → 4)"],
      ["WEEK 5 · 3 MAR", "Round 1 · Opener", "1–3", false, "Sent you to the losers’ match"],
      ["WEEK 6 · 10 MAR", "Round 3 · 1–1 decider", "3–2", true, "Earned 6 pts instead of 4"],
    ]);
  });

  it("builds their season from the sheet with engine path notes", () => {
    const t = theirSeason(ctx, bears.team.id, champs.team.id, "div2", true);
    expect(t.line).toBe("Royal Bears Rocket league · Division 2 · Finished 8th, 18 pts");
    expect(t.weeks).toEqual([
      { label: "WK 3", points: "6", note: "1–1, won decider" },
      { label: "WK 4", points: "4", note: "1–1, lost decider" },
      { label: "WK 5", points: "4", note: "1–1, lost decider" },
      { label: "WK 6", points: "4", note: "1–1, lost decider" },
    ]);
    expect(t.summary).toBe("Total 18 pts, level with Sussy Staffordians and 2 behind you. Playoffs: Round 1 bye.");
  });

  it("generates the approved pattern sentences", () => {
    expect(patterns(ctx, season, "div2", bears.team.id, opps).slice(0, 3)).toEqual([
      "You met them in 3 of 4 league nights, the most of any opponent.",
      "Two of the three meetings were 1–1 deciders: a direct 6 vs 4 points swing each time.",
      "They reached the 1–1 decider every single week, so that is where you are most likely to meet them.",
    ]);
  });

  it("explains a single playoff meeting and a promoted opponent", () => {
    const pirates = opps.find((o) => o.team.shortName === "Portsmouth Pirates")!;
    expect(patterns(ctx, season, "div2", pirates.team.id, opps)[0]).toBe(
      "You met them once, in the playoffs: lost the Last 16 2–4.",
    );
    expect(meetingsWith(ctx, season, pirates.team.id)[0]).toMatchObject({
      when: "PLAYOFFS · 17 MAR",
      round: "Last 16",
      effect: "Knocked you out in the Last 16",
      nightSlug: "playoffs",
    });
    const fw = opps.find((o) => o.team.shortName === "Fake Warwick")!;
    expect(theirSeason(ctx, fw.team.id, champs.team.id, "div2", true).line).toBe(
      "Fake Warwick · Division 2 · Promoted to Division 1 in Week 6",
    );
  });
});
