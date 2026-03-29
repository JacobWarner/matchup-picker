import { describe, it, expect } from "vitest";
import { toUggName, toDisplayName, CHAMPION_NAME_OVERRIDES } from "../src/champions.js";

describe("toUggName", () => {
  it("lowercases simple names", () => {
    expect(toUggName("Darius")).toBe("darius");
  });

  it("lowercases multi-word DDragon IDs", () => {
    expect(toUggName("MissFortune")).toBe("missfortune");
    expect(toUggName("DrMundo")).toBe("drmundo");
    expect(toUggName("LeeSin")).toBe("leesin");
  });

  it("handles MonkeyKing -> wukong special case", () => {
    expect(toUggName("MonkeyKing")).toBe("wukong");
  });
});

describe("toDisplayName", () => {
  it("returns display name from DDragon data", () => {
    const champions = {
      Darius: { id: "Darius", name: "Darius" },
      MonkeyKing: { id: "MonkeyKing", name: "Wukong" },
      MissFortune: { id: "MissFortune", name: "Miss Fortune" },
    };
    expect(toDisplayName("Darius", champions)).toBe("Darius");
    expect(toDisplayName("MonkeyKing", champions)).toBe("Wukong");
    expect(toDisplayName("MissFortune", champions)).toBe("Miss Fortune");
  });
});
