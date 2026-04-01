/**
 * Integration tests for the u.gg static JSON API client.
 *
 * These hit u.gg's servers live. Run manually:
 *   npx vitest run --config vitest.integration.config.ts
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

describe("Data access pattern (region/rank/role)", () => {
  it("returns correct data for Darius top emerald+", async () => {
    const patch = await getCurrentPatch();
    // Darius = champion key 122, top = role 4, emerald+ = tier 17
    const matchups = await fetchChampionMatchups("122", ROLE_TO_ID.top, RANK_TO_TIER.emerald_plus, patch);

    expect(matchups).not.toBeNull();
    const entries = Object.values(matchups!);
    expect(entries.length).toBeGreaterThan(50);

    // Garen (86) is a common opponent — should have thousands of games
    const garen = matchups![86];
    expect(garen).toBeDefined();
    expect(garen.totalGames).toBeGreaterThan(1000);

    // WR should be a realistic value (cross-checked against u.gg website)
    const wr = computeWinRate(garen);
    expect(wr).toBeGreaterThan(30);
    expect(wr).toBeLessThan(70);

    // GD@15 should be reasonable (-2000 to 2000 per game)
    const gd = computeGoldDiff15(garen);
    expect(gd).toBeGreaterThan(-2000);
    expect(gd).toBeLessThan(2000);
  }, 15000);

  it("returns high game counts for Jinx adc overall", async () => {
    const patch = await getCurrentPatch();
    // Jinx = 222, adc = role 3, overall = tier 8
    const matchups = await fetchChampionMatchups("222", ROLE_TO_ID.adc, RANK_TO_TIER.overall, patch);

    expect(matchups).not.toBeNull();
    const entries = Object.values(matchups!);
    expect(entries.length).toBeGreaterThan(20);

    // Overall rank should have significantly more games than a single tier
    const totalGames = entries.reduce((sum, e) => sum + e.totalGames, 0);
    expect(totalGames).toBeGreaterThan(50000);
  }, 15000);

  it("returns data for off-meta pick: Swain bot overall", async () => {
    const patch = await getCurrentPatch();
    // Swain = 50, adc = role 3, overall = tier 8
    const matchups = await fetchChampionMatchups("50", ROLE_TO_ID.adc, RANK_TO_TIER.overall, patch);

    expect(matchups).not.toBeNull();

    // Smolder (901) should appear as an opponent
    const smolder = matchups![901];
    expect(smolder).toBeDefined();
    expect(smolder.totalGames).toBeGreaterThan(500);
  }, 15000);
});

describe("Win rate and gold diff computation (inverted from file perspective)", () => {
  it("Darius WR vs Garen is ~51% (Darius favored)", async () => {
    const patch = await getCurrentPatch();
    const matchups = await fetchChampionMatchups("122", ROLE_TO_ID.top, RANK_TO_TIER.emerald_plus, patch);

    const garen = matchups![86];
    const wr = computeWinRate(garen);
    // File stores opponent (Garen's) wins. computeWinRate inverts.
    // Verified: Darius beats Garen ~51.4%, Garen's file confirms Darius at ~51.5%
    expect(wr).toBeGreaterThan(50);
    expect(wr).toBeLessThan(55);
  }, 15000);

  it("Darius GD@15 vs Garen is positive (Darius ahead at 15)", async () => {
    const patch = await getCurrentPatch();
    const matchups = await fetchChampionMatchups("122", ROLE_TO_ID.top, RANK_TO_TIER.emerald_plus, patch);

    const garen = matchups![86];
    const gd = computeGoldDiff15(garen);
    // File stores opponent's GD. computeGoldDiff15 inverts.
    // Verified: u.gg shows Garen at -550 GD@15 → Darius is +550 ahead
    expect(gd).toBeGreaterThan(0);
    expect(gd).toBeLessThan(2000);
  }, 15000);
});

describe("Role ID mapping verification", () => {
  it("Darius has most games in top role (4)", async () => {
    const patch = await getCurrentPatch();
    const top = await fetchChampionMatchups("122", ROLE_TO_ID.top, RANK_TO_TIER.overall, patch);
    const mid = await fetchChampionMatchups("122", ROLE_TO_ID.mid, RANK_TO_TIER.overall, patch);

    const topGames = Object.values(top!).reduce((s, e) => s + e.totalGames, 0);
    const midGames = mid ? Object.values(mid).reduce((s, e) => s + e.totalGames, 0) : 0;

    expect(topGames).toBeGreaterThan(midGames);
  }, 15000);

  it("Jinx has most games in adc role (3)", async () => {
    const patch = await getCurrentPatch();
    const adc = await fetchChampionMatchups("222", ROLE_TO_ID.adc, RANK_TO_TIER.overall, patch);
    const sup = await fetchChampionMatchups("222", ROLE_TO_ID.support, RANK_TO_TIER.overall, patch);

    const adcGames = Object.values(adc!).reduce((s, e) => s + e.totalGames, 0);
    const supGames = sup ? Object.values(sup).reduce((s, e) => s + e.totalGames, 0) : 0;

    expect(adcGames).toBeGreaterThan(supGames);
  }, 15000);
});

describe("Rank tier mapping verification", () => {
  it("overall (tier 8) has more games than emerald+ (tier 17)", async () => {
    const patch = await getCurrentPatch();
    const overall = await fetchChampionMatchups("122", ROLE_TO_ID.top, RANK_TO_TIER.overall, patch);
    const emeraldPlus = await fetchChampionMatchups("122", ROLE_TO_ID.top, RANK_TO_TIER.emerald_plus, patch);

    const overallGames = Object.values(overall!).reduce((s, e) => s + e.totalGames, 0);
    const emeraldGames = Object.values(emeraldPlus!).reduce((s, e) => s + e.totalGames, 0);

    expect(overallGames).toBeGreaterThan(emeraldGames);
  }, 15000);

  it("emerald+ (tier 17) WR matches u.gg website for Darius vs Garen", async () => {
    const patch = await getCurrentPatch();
    const matchups = await fetchChampionMatchups("122", ROLE_TO_ID.top, RANK_TO_TIER.emerald_plus, patch);

    const garen = matchups![86];
    const wr = computeWinRate(garen);
    // u.gg shows ~48.56% for Garen vs Darius emerald+ on 2026-03-31
    // Allow some drift between patches but should be in a reasonable range
    expect(wr).toBeGreaterThan(40);
    expect(wr).toBeLessThan(60);
  }, 15000);
});
