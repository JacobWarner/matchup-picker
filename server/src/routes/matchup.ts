import { Router, Request, Response } from "express";
import {
  fetchChampionMatchups,
  computeWinRate,
  computeGoldDiff15,
  getCurrentPatch,
  RANK_TO_TIER,
  ROLE_TO_ID,
} from "../api/ugg.js";
import {
  fetchChampions,
  findChampionId,
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

    // Resolve rank and role to API IDs
    const uggLane = LANE_MAP[lane];       // e.g. "top"
    const roleId = ROLE_TO_ID[uggLane];  // e.g. "4"
    const tierId = RANK_TO_TIER[rank];   // e.g. "10"

    // Get the enemy's numeric champion key (used as the lookup key in matchup data)
    const enemyNumericKey = champions[enemyId].key;

    // Use provided patch or fall back to current
    const patch = (req.body.patch && typeof req.body.patch === "string")
      ? req.body.patch
      : await getCurrentPatch();

    // Fetch matchup data for each pool champion concurrently
    const matchupResults = await Promise.all(
      poolIds.map((id) =>
        fetchChampionMatchups(
          champions[id].key,
          roleId,
          tierId,
          patch
        ).catch(() => null)
      )
    );

    const results: MatchupResult[] = poolIds.map((id, i) => {
      const champName = champions[id].name;
      const matchups = matchupResults[i];
      const enemyKeyNum = parseInt(enemyNumericKey, 10);
      const entry = matchups?.[enemyKeyNum] ?? null;

      const gamesPlayed = entry?.totalGames ?? null;

      // matchup data is from the pool champion's perspective:
      // wins = pool champion's wins vs the enemy → no inversion needed
      const winRate = entry ? computeWinRate(entry) : null;
      const goldDiff15 = entry ? computeGoldDiff15(entry) : null;

      return {
        champion: champName,
        championId: id,
        winRate,
        goldDiff15,
        gamesPlayed,
        tier: null,       // not available from static matchup JSON
        pickRate: null,   // not available without total-games-in-patch data
        banRate: null,    // not available without total-games-in-patch data
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
    res.status(500).json({ error: `Failed to fetch matchup data: ${message}` });
  }
});

export default router;
