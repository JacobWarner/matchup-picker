import { describe, it, expect } from "vitest";
import { parseWinRate, parseGames, parseGoldDiff } from "../src/scraper/parseUtils.js";

describe("parseWinRate", () => {
  it("extracts winrate from '55.56% WR'", () => {
    expect(parseWinRate("55.56% WR")).toBe(55.56);
  });

  it("extracts winrate from '49.43%'", () => {
    expect(parseWinRate("49.43%")).toBe(49.43);
  });

  it("returns null for invalid input", () => {
    expect(parseWinRate("no data")).toBeNull();
  });
});

describe("parseGames", () => {
  it("extracts games from '2,124 games'", () => {
    expect(parseGames("2,124 games")).toBe(2124);
  });

  it("extracts games from '107,494'", () => {
    expect(parseGames("107,494")).toBe(107494);
  });

  it("extracts games from '629 games'", () => {
    expect(parseGames("629 games")).toBe(629);
  });

  it("returns null for invalid input", () => {
    expect(parseGames("N/A")).toBeNull();
  });
});

describe("parseGoldDiff", () => {
  it("extracts positive gold diff from '+655 GD15'", () => {
    expect(parseGoldDiff("+655 GD15")).toBe(655);
  });

  it("extracts negative gold diff from '-210 GD15'", () => {
    expect(parseGoldDiff("-210 GD15")).toBe(-210);
  });

  it("returns null for invalid input", () => {
    expect(parseGoldDiff("no data")).toBeNull();
  });
});
