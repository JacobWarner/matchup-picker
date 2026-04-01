/**
 * u.gg static JSON API client.
 *
 * u.gg serves all matchup and overview data as pre-computed static JSON files.
 *
 * Data structure (matchup file):
 *   data[REGION][RANK_TIER][ROLE][0] = Array<MatchupEntry>
 *   data[REGION][RANK_TIER][ROLE][1] = timestamp string (ignored)
 *
 *   MatchupEntry: [champId, wins, totalGames, goldDiffTotal, ...]
 *
 * Verified mappings (cross-referenced against u.gg website and known champion data):
 *   Region 12 = World (all regions combined)
 *   Rank tier 10 = emerald+ (default on u.gg), 8 = all ranks (overall)
 *   Role 1=jungle, 2=support, 3=adc, 4=top, 5=mid
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = "https://stats2.u.gg/lol/1.5";
const PATCHES_URL =
  "https://static.bigbrain.gg/assets/lol/riot_patch_update/prod/ugg/patches.json";

// First-level key in the JSON is region. We always use World (all regions).
const WORLD_REGION = "12";

// Second-level key: rank tier.
// Verified: tier 10 (emerald+) for Darius top gives 311k games at world level.
// Tier 8 (overall) gives 737k games — confirmed as all ranks combined.
export const RANK_TO_TIER: Record<string, string> = {
  iron: "1",
  bronze: "2",
  silver: "3",
  gold: "4",
  platinum: "5",
  emerald: "6",
  diamond: "7",
  overall: "8",
  master: "9",
  emerald_plus: "10",
  diamond_plus: "11",
  master_plus: "12",
  grandmaster: "13",
  platinum_plus: "14",
  gold_plus: "15",
  silver_plus: "16",
  challenger: "17",
};

// Third-level key: role (confirmed by checking which key has the most games
// for known single-role champions: Darius=4(top), Jinx=3(adc), Lee Sin=1(jungle),
// Thresh=2(support), Ahri=5(mid)).
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

let cachedPatches: string[] | null = null;
let patchCacheTimestamp = 0;
const PATCH_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function getPatches(): Promise<string[]> {
  if (cachedPatches && Date.now() - patchCacheTimestamp < PATCH_CACHE_TTL_MS) {
    return cachedPatches;
  }

  const res = await fetch(PATCHES_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch u.gg patches list: HTTP ${res.status}`);
  }
  const patches: string[] = await res.json();
  if (!patches || patches.length === 0) {
    throw new Error("u.gg patches list is empty");
  }

  // Patches are in API key format: "16_6"
  cachedPatches = patches;
  patchCacheTimestamp = Date.now();
  return cachedPatches;
}

export async function getCurrentPatch(): Promise<string> {
  const patches = await getPatches();
  return patches[0];
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

  // Navigate: data[WORLD_REGION][tierId][roleId][0] = matchup array
  const regionData = raw[WORLD_REGION];
  if (!regionData || typeof regionData !== "object") return null;

  const tierData = (regionData as Record<string, unknown>)[tierId];
  if (!tierData || typeof tierData !== "object") return null;

  const roleData = (tierData as Record<string, unknown>)[roleId];
  if (!Array.isArray(roleData) || roleData.length === 0) return null;

  // roleData[0] = matchup entries array; roleData[1] = timestamp string
  const entries = roleData[0];
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
 * goldDiffTotal is the summed GD@15 across all games from the pool champion's
 * perspective (positive = pool champion was ahead). Verified against u.gg website
 * values for Darius top emerald+ matchups.
 */
export function computeGoldDiff15(entry: MatchupEntry): number {
  return Math.round(entry.goldDiffTotal / entry.totalGames);
}
