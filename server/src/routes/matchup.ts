import { Router, Request, Response } from "express";
import { scrapeCounterPage } from "../scraper/counterPage.js";
import { scrapeBuildPage } from "../scraper/buildPage.js";
import {
  fetchChampions,
  findChampionId,
  toUggName,
  normalizeChampionName,
} from "../champions.js";
import {
  MatchupRequest,
  MatchupResponse,
  MatchupResult,
  LANE_MAP,
  RANK_MAP,
} from "../types.js";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const { pool, enemy, lane, rank } = req.body as MatchupRequest;

    if (!pool || !Array.isArray(pool) || pool.length === 0) {
      res.status(400).json({ error: "pool must be a non-empty array" });
      return;
    }
    if (pool.length > 5) {
      res.status(400).json({ error: "pool cannot exceed 5 champions" });
      return;
    }
    if (!pool.every((p: unknown) => typeof p === "string" && p.length > 0 && p.length < 50)) {
      res.status(400).json({ error: "pool must contain only non-empty champion name strings" });
      return;
    }
    if (!enemy || typeof enemy !== "string") {
      res.status(400).json({ error: "enemy is required" });
      return;
    }
    if (!lane || !LANE_MAP[lane]) {
      res.status(400).json({ error: `invalid lane: ${lane}. Valid: ${Object.keys(LANE_MAP).join(", ")}` });
      return;
    }
    if (!rank || !RANK_MAP[rank]) {
      res.status(400).json({ error: `invalid rank: ${rank}. Valid: ${Object.keys(RANK_MAP).join(", ")}` });
      return;
    }

    const { champions } = await fetchChampions();

    const enemyId = findChampionId(enemy, champions);
    if (!enemyId) {
      res.status(400).json({ error: `unknown champion: ${enemy}` });
      return;
    }

    const poolIds: string[] = [];
    for (const name of pool) {
      const id = findChampionId(name, champions);
      if (id) poolIds.push(id);
    }

    if (poolIds.length === 0) {
      res.status(400).json({ error: "no valid champions in pool" });
      return;
    }

    const uggLane = LANE_MAP[lane];
    const uggRank = RANK_MAP[rank];
    const enemyNormalized = normalizeChampionName(champions[enemyId].name);

    // Scrape each POOL CHAMPION's counter page (not the enemy's).
    // The enemy's counter page only lists champions commonly played in that role,
    // so off-meta picks (e.g. Swain bot) would be missing. By scraping each pool
    // champion's page, we find the enemy in THEIR matchup lists instead.
    const scrapeResults = await Promise.all([
      ...poolIds.map((id) => scrapeCounterPage(toUggName(id), uggLane, uggRank)),
      ...poolIds.map((id) => scrapeBuildPage(toUggName(id), uggLane, uggRank)),
    ]);

    const counterResults = scrapeResults.slice(0, poolIds.length) as Awaited<ReturnType<typeof scrapeCounterPage>>[];
    const buildResults = scrapeResults.slice(poolIds.length) as Awaited<ReturnType<typeof scrapeBuildPage>>[];

    const results: MatchupResult[] = poolIds.map((id, i) => {
      const champName = champions[id].name;
      const counterData = counterResults[i];
      const enemyEntry = counterData[enemyNormalized] ?? null;
      const build = buildResults[i];
      const gamesPlayed = enemyEntry?.gamesPlayed ?? null;

      // Counter page shows stats from the OPPONENT's perspective:
      // "Best Picks vs Swain" shows opponents that beat Swain, with the opponent's WR.
      // So we invert: poolChampWR = 100 - enemyWR, and poolChampGD = -enemyGD.
      const winRate = enemyEntry?.winRate != null
        ? Math.round((100 - enemyEntry.winRate) * 100) / 100
        : null;
      const goldDiff15 = enemyEntry?.goldDiff15 != null
        ? -enemyEntry.goldDiff15
        : null;

      return {
        champion: champName,
        championId: id,
        winRate,
        goldDiff15,
        gamesPlayed,
        tier: build.tier,
        pickRate: build.pickRate,
        banRate: build.banRate,
        confidence:
          gamesPlayed === null
            ? "no-data"
            : gamesPlayed >= 500
              ? "high"
              : "low",
      };
    });

    results.sort((a, b) => {
      if (a.winRate === null && b.winRate === null) return 0;
      if (a.winRate === null) return 1;
      if (b.winRate === null) return -1;
      return b.winRate - a.winRate;
    });

    const response: MatchupResponse = {
      enemy: champions[enemyId].name,
      lane,
      rank,
      results,
    };

    res.json(response);
  } catch (err) {
    console.error("Matchup error:", err);

    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("rate limited") || message.includes("bot detection")) {
      res.status(429).json({ error: message });
    } else if (message.includes("page structure may have changed")) {
      res.status(502).json({ error: message });
    } else {
      res.status(500).json({ error: `Failed to fetch matchup data: ${message}` });
    }
  }
});

export default router;
