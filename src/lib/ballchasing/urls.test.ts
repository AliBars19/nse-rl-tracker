import { describe, expect, it } from "vitest";
import { replayPage, replayViewer } from "./urls";

describe("ballchasing links", () => {
  it("links the replay page and its 3D viewer tab", () => {
    expect(replayPage("f9be9b39-5365-4513-ba36-ab583fa3cdd8")).toBe("https://ballchasing.com/replay/f9be9b39-5365-4513-ba36-ab583fa3cdd8");
    expect(replayViewer("abc")).toBe("https://ballchasing.com/replay/abc#watch");
  });

  it("escapes anything unexpected in an id", () => {
    expect(replayPage("a/b?c")).toBe("https://ballchasing.com/replay/a%2Fb%3Fc");
  });
});
