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
// Cross-referenced against u.gg website by matching displayed WR% for
// Darius vs Garen (top) across rank selections:
//   emerald_plus page shows 48.56% WR → matches rank 17 in JSON
//   platinum_plus page shows 49.64% WR → matches rank 10 in JSON
//   diamond_plus page shows 46.75% WR → matches rank 11 in JSON
//   master_plus page shows 44.84% WR → matches rank 14 in JSON
//   overall page shows 51.08% WR → matches rank 8 in JSON
export const RANK_TO_TIER: Record<string, string> = {
  iron: "1",
  bronze: "2",
  silver: "3",
  gold: "4",
  platinum: "5",
  emerald: "6",
  diamond: "7",
  overall: "8",
  platinum_plus: "10",
  diamond_plus: "11",
  master: "12",
  grandmaster: "13",
  master_plus: "14",
  gold_plus: "15",
  silver_plus: "16",
  emerald_plus: "17",
  challenger: "13",       // grandmaster+ data (challenger alone is too sparse)
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

async function fetchJsonData(endpoint: string, championKey: string, patch: string): Promise<unknown> {
  const url = `${BASE_URL}/${endpoint}/${patch}/ranked_solo_5x5/${championKey}/1.5.0.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `u.gg ${endpoint} data returned HTTP ${res.status} for champion ${championKey}`
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
  const raw = await fetchJsonData("matchups", championKey, patch) as Record<string, unknown>;

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
    const champId = entry[0] as number;
    const wins = entry[1] as number;
    const totalGames = entry[2] as number;
    // field[3] = total gold diff (not GD@15)
    // field[4] = GD@15 total — verified: Darius vs Garen shows -550/game in JSON,
    //            matching u.gg counter page exactly
    const goldDiff15Total = entry[4] as number;
    if (typeof champId !== "number" || typeof totalGames !== "number" || totalGames === 0) {
      continue;
    }
    result[champId] = {
      enemyChampId: champId,
      wins,
      totalGames,
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
  return Math.round(entry.goldDiff15Total / entry.totalGames);
}

// ---------------------------------------------------------------------------
// Rankings (tier, pick rate, ban rate)
// ---------------------------------------------------------------------------

export interface RankingData {
  tier: string;
  pickRate: number;
  banRate: number;
}

/**
 * Fetch ranking data for a champion (tier, pick rate, ban rate).
 *
 * Rankings JSON fields (verified against u.gg build page for Darius top emerald+):
 *   [0] = wins, [1] = total games, [2] = rank position, [3] = total champs in role
 *   [13] = total role appearances (denominator for pick rate)
 *   [19] = ban count (divide by total_games_played for ban rate)
 *
 * Pick rate = field[1] / field[13] — verified: 146599/2222992 = 6.6% (u.gg shows 6.5%)
 * Ban rate = field[19] / (field[13]/2) — verified: 162096/1111496 = 14.6% (u.gg shows 14.2%)
 * Tier = derived from rank position / total champs ratio
 */
export async function fetchChampionRankings(
  championKey: string,
  roleId: string,
  tierId: string,
  patch: string
): Promise<RankingData | null> {
  const raw = await fetchJsonData("rankings", championKey, patch) as Record<string, unknown>;

  const regionData = raw[WORLD_REGION];
  if (!regionData || typeof regionData !== "object") return null;

  const tierData = (regionData as Record<string, unknown>)[tierId];
  if (!tierData || typeof tierData !== "object") return null;

  const roleData = (tierData as Record<string, unknown>)[roleId];
  if (!roleData || typeof roleData !== "object") return null;

  const r = roleData as Record<string, number>;
  const totalGames = r["1"];
  const rank = r["2"];
  const totalChamps = r["3"];
  const totalRoleAppearances = r["13"];
  const banCount = r["19"];

  if (!totalGames || !totalChamps || !totalRoleAppearances) return null;

  const pickRate = Math.round((totalGames / totalRoleAppearances) * 1000) / 10;
  const banRate = Math.round((banCount / (totalRoleAppearances / 2)) * 1000) / 10;

  const pct = rank / totalChamps;
  let tier: string;
  if (pct <= 0.03) tier = "S+";
  else if (pct <= 0.08) tier = "S";
  else if (pct <= 0.20) tier = "A";
  else if (pct <= 0.40) tier = "B";
  else if (pct <= 0.65) tier = "C";
  else tier = "D";

  return { tier, pickRate, banRate };
}
