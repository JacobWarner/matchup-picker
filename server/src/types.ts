export interface MatchupResult {
  champion: string;
  championId: string;
  winRate: number | null;
  goldDiff15: number | null;
  gamesPlayed: number | null;
  tier: string | null;
  pickRate: number | null;
  banRate: number | null;
  confidence: "high" | "low" | "no-data";
}

export interface MatchupRequest {
  pool: string[];
  enemy: string;
  lane: string;
  rank: string;
}

export interface MatchupResponse {
  enemy: string;
  lane: string;
  rank: string;
  results: MatchupResult[];
}

// Valid rank values accepted by the API.
// The actual tier ID mapping lives in server/src/api/ugg.ts (RANK_TO_TIER).
export const RANK_MAP: Record<string, true> = {
  iron: true,
  bronze: true,
  silver: true,
  gold: true,
  platinum: true,
  emerald: true,
  diamond: true,
  master: true,
  grandmaster: true,
  challenger: true,
  master_plus: true,
  diamond_plus: true,
  emerald_plus: true,
  platinum_plus: true,
  overall: true,
};

// Maps frontend lane keys to u.gg role names (which then map to role IDs in ugg.ts).
export const LANE_MAP: Record<string, string> = {
  top: "top",
  jungle: "jungle",
  mid: "mid",
  bot: "adc",
  support: "support",
};
