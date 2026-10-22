import { afterEach, describe, expect, it } from "vitest";
import { ballchasingVisibility, parseVisibility } from "./env";

describe("parseVisibility", () => {
  it("accepts the three ballchasing values however they were typed", () => {
    expect(parseVisibility("public")).toBe("public");
    expect(parseVisibility("Public")).toBe("public");
    expect(parseVisibility("  UNLISTED ")).toBe("unlisted");
    expect(parseVisibility("private\n")).toBe("private");
  });

  it("strips quotes pasted around the value", () => {
    expect(parseVisibility('"public"')).toBe("public");
    expect(parseVisibility("'unlisted'")).toBe("unlisted");
  });

  it("falls back to unlisted for anything else, including empty", () => {
    expect(parseVisibility(undefined)).toBe("unlisted");
    expect(parseVisibility("")).toBe("unlisted");
    expect(parseVisibility("   ")).toBe("unlisted");
    expect(parseVisibility("everyone")).toBe("unlisted");
    expect(parseVisibility("public, unlisted")).toBe("unlisted");
  });
});

describe("ballchasingVisibility", () => {
  const saved = process.env.BALLCHASING_VISIBILITY;
  afterEach(() => {
    if (saved === undefined) delete process.env.BALLCHASING_VISIBILITY;
    else process.env.BALLCHASING_VISIBILITY = saved;
  });

  it("reads BALLCHASING_VISIBILITY", () => {
    process.env.BALLCHASING_VISIBILITY = " Public ";
    expect(ballchasingVisibility()).toBe("public");
    delete process.env.BALLCHASING_VISIBILITY;
    expect(ballchasingVisibility()).toBe("unlisted");
  });
});
