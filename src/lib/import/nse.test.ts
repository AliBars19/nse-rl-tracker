import { describe, expect, it } from "vitest";
import { londonTimeToIso, nseKickoffToIso } from "./nse";

describe("UK local time to UTC", () => {
  it("is unchanged in winter (GMT)", () => {
    expect(nseKickoffToIso("17 Feb 26", "19:15")).toBe("2026-02-17T19:15:00.000Z");
  });
  it("subtracts an hour in summer time (BST)", () => {
    expect(londonTimeToIso("2026-10-06", "19:00")).toBe("2026-10-06T18:00:00.000Z");
  });
});
