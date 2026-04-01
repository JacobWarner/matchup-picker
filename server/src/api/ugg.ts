/**
 * u.gg static JSON API client.
 *
 * Replaces the Playwright-based scrapers entirely. u.gg serves all matchup and
 * overview data as pre-computed static JSON files, so we just fetch and parse them.
 *
 * Data structure (matchup file):
 *   data[tierKey][roleKey]["4"][0] = Array<MatchupEntry>
 *   data[tierKey][roleKey]["4"][1] = timestamp string (ignored)
 *
 *   MatchupEntry: [champId, wins, totalGames, goldDiffTotal, goldDiff15Total, ...]
 *
 * Verified mappings:
 *   Rank tier 10 = emerald+ (default on u.gg, confirmed against known data)
 *   Role 1=jungle, 2=support, 3=adc, 4=top, 5=mid
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = "https://stats2.u.gg/lol/1.5";
const PATCHES_URL =
  "https://static.bigbrain.gg/assets/lol/riot_patch_update/prod/ugg/patches.json";

// Rank tier keys used in the u.gg API JSON files.
// Key "10" = emerald+ is the confirmed default and most-used tier.
// Individual ranks 1–9 follow iron → grandmaster order.
// Aggregate "plus" tiers: 11=diamond+, 12=overall, 14=platinum+, 16=gold+, 17=silver+, 18=challenger.
export const RANK_TO_TIER: Record<string, string> = {
  iron: "1",
  bronze: "2",
  silver: "3",
  gold: "4",
  platinum: "5",
  emerald: "6",
  diamond: "7",
  master: "8",
  grandmaster: "9",
  emerald_plus: "10",    // default on u.gg
  diamond_plus: "11",
  overall: "12",
  platinum_plus: "14",
  gold_plus: "16",
  silver_plus: "17",
  challenger: "18",
  master_plus: "11",     // same tier as diamond+ (high elo combined)
};

// Role ID keys used in the u.gg API JSON files.
// Confirmed by cross-referencing opponent champion identities in the data.
export const ROLE_TO_ID: Record<string, string> = {
  jungle: "1",
  support: "2",
  adc: "3",
  top: "4",
  mid: "5",
};

// ---------------------------------------------------------------------------
// Patch helpers
// ---------------------------------------------------------------------------

let cachedPatch: string | null = null;
let patchCacheTimestamp = 0;
const PATCH_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function getCurrentPatch(): Promise<string> {
  if (cachedPatch && Date.now() - patchCacheTimestamp < PATCH_CACHE_TTL_MS) {
    return cachedPatch;
  }

  const res = await fetch(PATCHES_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch u.gg patches list: HTTP ${res.status}`);
  }
  const patches: string[] = await res.json();
  if (!patches || patches.length === 0) {
    throw new Error("u.gg patches list is empty");
  }

  // Patches are already in the API key format: "16_6"
  cachedPatch = patches[0];
  patchCacheTimestamp = Date.now();
  return cachedPatch;
}

// ---------------------------------------------------------------------------
// Raw data fetchers
// ---------------------------------------------------------------------------

async function fetchMatchupData(championKey: string, patch: string): Promise<unknown> {
  const url = `${BASE_URL}/matchups/${patch}/ranked_solo_5x5/${championKey}/1.5.0.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `u.gg matchup data returned HTTP ${res.status} for champion ${championKey}`
    );
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Matchup result types
// ---------------------------------------------------------------------------

export interface MatchupEntry {
  enemyChampId: number;
  wins: number;
  totalGames: number;
  goldDiffTotal: number;
  goldDiff15Total: number;
}

export interface ChampionMatchups {
  [enemyChampId: number]: MatchupEntry;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch and parse matchup data for a pool champion against all opponents.
 *
 * Returns a map from enemy champion ID to matchup stats, or null if the
 * champion/role/rank combination has no data.
 *
 * @param championKey  Numeric champion key (e.g. "122" for Darius)
 * @param roleId       Role ID from ROLE_TO_ID (e.g. "4" for top)
 * @param tierId       Tier ID from RANK_TO_TIER (e.g. "10" for emerald+)
 * @param patch        Patch string in API format (e.g. "16_6")
 */
export async function fetchChampionMatchups(
  championKey: string,
  roleId: string,
  tierId: string,
  patch: string
): Promise<ChampionMatchups | null> {
  const raw = await fetchMatchupData(championKey, patch) as Record<string, unknown>;

  // Navigate: data[tierId][roleId]["4"][0] = matchup array
  const tierData = raw[tierId];
  if (!tierData || typeof tierData !== "object") return null;

  const roleData = (tierData as Record<string, unknown>)[roleId];
  if (!roleData || typeof roleData !== "object") return null;

  const slot4 = (roleData as Record<string, unknown>)["4"];
  if (!Array.isArray(slot4) || slot4.length === 0) return null;

  // slot4[0] = matchup entries array; slot4[1] = timestamp string
  const entries = slot4[0];
  if (!Array.isArray(entries) || entries.length === 0) return null;

  const result: ChampionMatchups = {};
  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length < 5) continue;
    const [champId, wins, totalGames, goldDiffTotal, goldDiff15Total] = entry as number[];
    if (typeof champId !== "number" || typeof totalGames !== "number" || totalGames === 0) {
      continue;
    }
    result[champId] = {
      enemyChampId: champId,
      wins,
      totalGames,
      goldDiffTotal,
      goldDiff15Total,
    };
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Compute win rate for the pool champion against a specific enemy.
 *
 * The matchup file stores data from the pool champion's perspective:
 * entry.wins = number of times the pool champion won vs this enemy.
 * So WR = wins / totalGames directly (no inversion needed).
 */
export function computeWinRate(entry: MatchupEntry): number {
  return Math.round((entry.wins / entry.totalGames) * 10000) / 100;
}

/**
 * Compute average gold difference at 15 minutes for the pool champion.
 *
 * goldDiff15Total is the summed GD@15 across all games from the pool champion's
 * perspective (positive = pool champion was ahead).
 */
export function computeGoldDiff15(entry: MatchupEntry): number {
  return Math.round(entry.goldDiff15Total / entry.totalGames);
}
