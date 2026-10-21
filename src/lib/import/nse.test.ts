import { describe, expect, it } from "vitest";
import { londonTimeToIso, nseKickoffToIso, tournamentSlugFrom } from "./nse";

describe("UK local time to UTC", () => {
  it("is unchanged in winter (GMT)", () => {
    expect(nseKickoffToIso("17 Feb 26", "19:15")).toBe("2026-02-17T19:15:00.000Z");
  });
  it("subtracts an hour in summer time (BST)", () => {
    expect(londonTimeToIso("2026-10-06", "19:00")).toBe("2026-10-06T18:00:00.000Z");
  });
});

describe("tournamentSlugFrom", () => {
  it("takes a bare slug as is (lower-cased)", () => {
    expect(tournamentSlugFrom("rocket-league-nse-winter-26")).toBe("rocket-league-nse-winter-26");
    expect(tournamentSlugFrom("  Rocket-League-NSE-Winter-26 ")).toBe("rocket-league-nse-winter-26");
  });

  it("pulls the slug out of a pasted tournament URL", () => {
    expect(tournamentSlugFrom("https://nse.gg/tournaments/rocket-league-nse-winter-26")).toBe("rocket-league-nse-winter-26");
    expect(tournamentSlugFrom("https://tournaments.nse.gg/tournaments/rocket-league-nse-winter-26/stage-1?x=1")).toBe("rocket-league-nse-winter-26");
    expect(tournamentSlugFrom("nse.gg/tournaments/rocket-league-nse-spring-26-division-2/teams/city-champions")).toBe("rocket-league-nse-spring-26-division-2");
  });

  it("returns null for empty or unusable input", () => {
    expect(tournamentSlugFrom("")).toBeNull();
    expect(tournamentSlugFrom("   ")).toBeNull();
    expect(tournamentSlugFrom("not a slug!")).toBeNull();
    expect(tournamentSlugFrom("https://nse.gg/profiles/stav1c")).toBeNull();
  });
});

