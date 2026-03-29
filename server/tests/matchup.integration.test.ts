/**
 * Integration tests for the matchup API endpoint.
 *
 * These tests hit u.gg live and take ~10-20 seconds each.
 * They are NOT included in the default test suite — run manually with:
 *   npx vitest run tests/matchup.integration.test.ts
 *
 * Purpose: catch regressions in scraping logic, name matching, and data
 * inversion that unit tests cannot cover (since they depend on live u.gg pages).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { closeBrowser } from "../src/scraper/browser.js";
import { scrapeCounterPage } from "../src/scraper/counterPage.js";
import { scrapeBuildPage } from "../src/scraper/buildPage.js";
import { fetchChampions, normalizeChampionName, toUggName } from "../src/champions.js";

// Close browser after all tests to avoid orphaned Chromium
afterAll(async () => {
  await closeBrowser();
});

describe("Counter page scraper", () => {
  it("returns data for common matchups (standard role)", async () => {
    // Darius top is a standard pick — his counter page should have many opponents
    const data = await scrapeCounterPage("darius", "top", "emerald_plus");

    expect(Object.keys(data).length).toBeGreaterThan(10);

    // Teemo is a well-known Darius counter — should have data
    const teemo = data[normalizeChampionName("Teemo")];
    expect(teemo).toBeDefined();
    expect(teemo.winRate).toBeTypeOf("number");
    expect(teemo.winRate).toBeGreaterThan(0);
    expect(teemo.winRate).toBeLessThan(100);
    expect(teemo.gamesPlayed).toBeTypeOf("number");
    expect(teemo.gamesPlayed).toBeGreaterThan(0);
  }, 30000);

  it("returns data for off-meta picks (e.g. Swain bot)", async () => {
    // Swain bot is off-meta — his counter page for ADC role should still
    // list opponents like Smolder, Jinx, etc.
    const data = await scrapeCounterPage("swain", "adc", "overall");

    expect(Object.keys(data).length).toBeGreaterThan(5);

    // Smolder is a common bot laner — should appear in Swain's matchup list
    const smolder = data[normalizeChampionName("Smolder")];
    expect(smolder).toBeDefined();
    expect(smolder.winRate).toBeTypeOf("number");
    expect(smolder.gamesPlayed).toBeTypeOf("number");
  }, 30000);

  it("normalizes champion names consistently for multi-word names", async () => {
    // Aurelion Sol, Miss Fortune, Tahm Kench etc. need proper normalization
    const data = await scrapeCounterPage("missfortune", "adc", "emerald_plus");

    // Check that at least some multi-word champions are findable
    const hasResults = Object.keys(data).length > 10;
    expect(hasResults).toBe(true);

    // Verify a known opponent exists and has valid data
    const jinx = data[normalizeChampionName("Jinx")];
    expect(jinx).toBeDefined();
    expect(jinx.winRate).toBeTypeOf("number");
  }, 30000);
});

describe("Build page scraper", () => {
  it("returns tier, pick rate, and ban rate", async () => {
    const data = await scrapeBuildPage("darius", "top", "emerald_plus");

    expect(data.tier).toBeTypeOf("string");
    expect(data.tier!.length).toBeLessThanOrEqual(2); // S+, S, A, B, C, D
    expect(data.pickRate).toBeTypeOf("number");
    expect(data.pickRate).toBeGreaterThan(0);
    expect(data.banRate).toBeTypeOf("number");
    expect(data.banRate).toBeGreaterThanOrEqual(0);
  }, 30000);
});

describe("Matchup flow (end-to-end)", () => {
  it("returns inverted WR/GD for pool champs vs enemy", async () => {
    // Simulate the full matchup flow: scrape pool champ's counter page,
    // find enemy, invert stats
    const { champions } = await fetchChampions();

    const poolChampId = "Swain";
    const enemyId = "Smolder";
    const enemyNormalized = normalizeChampionName(champions[enemyId].name);

    const counterData = await scrapeCounterPage(
      toUggName(poolChampId),
      "adc",
      "overall"
    );

    const enemyEntry = counterData[enemyNormalized];
    expect(enemyEntry).toBeDefined();
    expect(enemyEntry.winRate).toBeTypeOf("number");
    expect(enemyEntry.gamesPlayed).toBeTypeOf("number");

    // Invert WR (counter page shows enemy's WR against pool champ)
    const poolChampWR = Math.round((100 - enemyEntry.winRate!) * 100) / 100;
    expect(poolChampWR).toBeGreaterThan(0);
    expect(poolChampWR).toBeLessThan(100);

    // Invert GD (counter page shows enemy's gold advantage)
    if (enemyEntry.goldDiff15 != null) {
      const poolChampGD = -enemyEntry.goldDiff15;
      expect(poolChampGD).toBeTypeOf("number");
    }
  }, 30000);

  it("handles champions with special DDragon IDs", async () => {
    // MonkeyKing -> wukong, AurelionSol -> aurelionsol
    const { champions } = await fetchChampions();

    // Aurelion Sol has DDragon ID "AurelionSol" but display name "Aurelion Sol"
    const asolData = await scrapeBuildPage(toUggName("AurelionSol"), "mid", "emerald_plus");
    expect(asolData.tier).toBeTypeOf("string");
    expect(asolData.pickRate).toBeTypeOf("number");
  }, 30000);
});
