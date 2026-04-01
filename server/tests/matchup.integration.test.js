/**
 * Integration tests for the u.gg static JSON API.
 *
 * These tests hit u.gg live and take a few seconds each.
 * They are NOT included in the default test suite — run manually with:
 *   npx vitest run tests/matchup.integration.test.js
 *
 * Purpose: catch regressions in the API fetching, data parsing, and matchup
 * logic that unit tests cannot cover (since they depend on live u.gg data).
 */
import { describe, it, expect } from "vitest";
import {
  fetchChampionMatchups,
  computeWinRate,
  computeGoldDiff15,
  getCurrentPatch,
  RANK_TO_TIER,
  ROLE_TO_ID,
} from "../src/api/ugg.js";
import { fetchChampions } from "../src/champions.js";

describe("getCurrentPatch", () => {
  it("returns a patch string in API format (e.g. '16_6')", async () => {
    const patch = await getCurrentPatch();
    expect(patch).toMatch(/^\d+_\d+$/);
  }, 10000);
});

describe("fetchChampionMatchups", () => {
  it("returns matchup data for Darius top emerald+", async () => {
    const patch = await getCurrentPatch();
    // Darius = key 122, top = role "4", emerald+ = tier "10"
    const matchups = await fetchChampionMatchups("122", ROLE_TO_ID.top, RANK_TO_TIER.emerald_plus, patch);

    expect(matchups).not.toBeNull();
    expect(Object.keys(matchups).length).toBeGreaterThan(10);

    // Garen (key 86) is well-known as a common Darius matchup with many games
    const garen = matchups[86];
    expect(garen).toBeDefined();
    expect(garen.totalGames).toBeGreaterThan(500);
    expect(garen.wins).toBeGreaterThan(0);
    expect(garen.wins).toBeLessThan(garen.totalGames);
  }, 15000);

  it("win rate for Darius vs Garen is a reasonable percentage", async () => {
    const patch = await getCurrentPatch();
    const matchups = await fetchChampionMatchups("122", ROLE_TO_ID.top, RANK_TO_TIER.emerald_plus, patch);
    const garen = matchups?.[86];
    expect(garen).toBeDefined();

    const wr = computeWinRate(garen);
    expect(wr).toBeGreaterThan(0);
    expect(wr).toBeLessThan(100);
    // Darius vs Garen is roughly 50/50; verify it's in a reasonable range
    expect(wr).toBeGreaterThan(35);
    expect(wr).toBeLessThan(65);
  }, 15000);

  it("GD@15 for Darius vs Garen is a reasonable number", async () => {
    const patch = await getCurrentPatch();
    const matchups = await fetchChampionMatchups("122", ROLE_TO_ID.top, RANK_TO_TIER.emerald_plus, patch);
    const garen = matchups?.[86];
    expect(garen).toBeDefined();

    const gd = computeGoldDiff15(garen);
    expect(typeof gd).toBe("number");
    // GD@15 should be within a few hundred gold of zero for a balanced matchup
    expect(Math.abs(gd)).toBeLessThan(500);
  }, 15000);

  it("returns null or sparse data for a champion in an unexpected role at high rank", async () => {
    const patch = await getCurrentPatch();
    // Darius support challenger would have essentially no games
    const matchups = await fetchChampionMatchups("122", ROLE_TO_ID.support, "18", patch);
    // Either null (no data) or sparse data — both are acceptable
    // The important thing is the function doesn't throw
    if (matchups !== null) {
      // If data exists, wins should be non-negative integers
      for (const entry of Object.values(matchups)) {
        expect(entry.wins).toBeGreaterThanOrEqual(0);
        expect(entry.totalGames).toBeGreaterThan(0);
      }
    }
  }, 15000);
});

describe("Matchup flow (end-to-end with champion data)", () => {
  it("can look up an enemy by numeric key and compute stats", async () => {
    const [patch, { champions }] = await Promise.all([
      getCurrentPatch(),
      fetchChampions(),
    ]);

    // Swain bot vs Smolder
    const swain = champions["Swain"];
    const smolder = champions["Smolder"];
    expect(swain).toBeDefined();
    expect(smolder).toBeDefined();

    const matchups = await fetchChampionMatchups(
      swain.key,
      ROLE_TO_ID.adc,
      RANK_TO_TIER.overall,
      patch
    );

    // Swain bot overall should have some matchup data
    if (matchups !== null) {
      const smolderEntry = matchups[parseInt(smolder.key, 10)];
      if (smolderEntry) {
        const wr = computeWinRate(smolderEntry);
        expect(wr).toBeGreaterThan(0);
        expect(wr).toBeLessThan(100);
      }
    }
    // If no data, the test still passes — off-meta picks may have sparse data
  }, 20000);
});
