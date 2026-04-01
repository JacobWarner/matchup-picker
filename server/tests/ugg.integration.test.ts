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
  it("returns high game counts for Darius top emerald+", async () => {
    const patch = await getCurrentPatch();
    // Darius = champion key 122, top = role 4, emerald+ = tier 10
    const matchups = await fetchChampionMatchups("122", ROLE_TO_ID.top, RANK_TO_TIER.emerald_plus, patch);

    expect(matchups).not.toBeNull();
    // Darius top should have 100+ matchup entries
    const entries = Object.values(matchups!);
    expect(entries.length).toBeGreaterThan(50);

    // Garen (86) is Darius's most common opponent — should have thousands of games
    const garen = matchups![86];
    expect(garen).toBeDefined();
    expect(garen.totalGames).toBeGreaterThan(1000);
  }, 15000);

  it("returns high game counts for Jinx adc overall", async () => {
    const patch = await getCurrentPatch();
    // Jinx = 222, adc = role 3, overall = tier 8
    const matchups = await fetchChampionMatchups("222", ROLE_TO_ID.adc, RANK_TO_TIER.overall, patch);

    expect(matchups).not.toBeNull();
    const entries = Object.values(matchups!);
    expect(entries.length).toBeGreaterThan(20);

    // Total games across all matchups should be massive for overall rank
    const totalGames = entries.reduce((sum, e) => sum + e.totalGames, 0);
    expect(totalGames).toBeGreaterThan(100000);
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

describe("Win rate and gold diff computation", () => {
  it("computes correct win rate from matchup entry", async () => {
    const patch = await getCurrentPatch();
    const matchups = await fetchChampionMatchups("122", ROLE_TO_ID.top, RANK_TO_TIER.emerald_plus, patch);

    const garen = matchups![86];
    const wr = computeWinRate(garen);
    // Win rate should be between 30-70% for a real matchup
    expect(wr).toBeGreaterThan(30);
    expect(wr).toBeLessThan(70);
  }, 15000);

  it("computes reasonable gold diff per game", async () => {
    const patch = await getCurrentPatch();
    const matchups = await fetchChampionMatchups("122", ROLE_TO_ID.top, RANK_TO_TIER.emerald_plus, patch);

    const garen = matchups![86];
    const gd = computeGoldDiff15(garen);
    // Gold diff at 15 should be between -2000 and 2000
    expect(gd).toBeGreaterThan(-2000);
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
  it("overall tier has more games than emerald+ tier", async () => {
    const patch = await getCurrentPatch();
    const overall = await fetchChampionMatchups("122", ROLE_TO_ID.top, RANK_TO_TIER.overall, patch);
    const emeraldPlus = await fetchChampionMatchups("122", ROLE_TO_ID.top, RANK_TO_TIER.emerald_plus, patch);

    const overallGames = Object.values(overall!).reduce((s, e) => s + e.totalGames, 0);
    const emeraldGames = Object.values(emeraldPlus!).reduce((s, e) => s + e.totalGames, 0);

    expect(overallGames).toBeGreaterThan(emeraldGames);
  }, 15000);
});
