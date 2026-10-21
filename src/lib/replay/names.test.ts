import { describe, expect, it } from "vitest";
import { foldName, looseName, sameName } from "./names";

describe("player name matching", () => {
  it("folds case, punctuation and leetspeak", () => {
    expect(foldName("stav1c")).toBe("stavic");
    expect(foldName("Yam.een")).toBe("yameen");
    expect(foldName("  Ca_prillix ")).toBe("caprillix");
    expect(foldName("salt ナ")).toBe("saltナ"); // other scripts are kept
  });

  it("sameName: the roster names and the in-game names Ali actually has", () => {
    expect(sameName("stav1c", "Stavic")).toBe(true);
    expect(sameName("yam.een", "Yameen")).toBe(true);
    expect(sameName("Caprillix", "caprillix")).toBe(true);
    expect(sameName("kidwys", "kid")).toBe(false); // strict: not a prefix match
    expect(sameName("Sols", "Stavic")).toBe(false);
    expect(sameName("", "")).toBe(false);
  });

  it("looseName also accepts a name that starts with, or contains, the other", () => {
    expect(looseName("kidwys", "kid")).toBe(true);
    expect(looseName("Dylan2006123", "Dylan06")).toBe(false); // too different to claim
    expect(looseName("Oliverjk9342", "Olly9342")).toBe(false);
    expect(looseName("xXStavicXx", "Stavic")).toBe(true);
    expect(looseName("ab", "abc")).toBe(false); // too short to be meaningful
    expect(looseName("Sols", "Stavic")).toBe(false);
  });
});
