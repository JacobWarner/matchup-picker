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

export const RANK_MAP: Record<string, string> = {
  iron: "iron",
  bronze: "bronze",
  silver: "silver",
  gold: "gold",
  platinum: "platinum",
  emerald: "emerald",
  diamond: "diamond",
  master: "master",
  grandmaster: "grandmaster",
  challenger: "challenger",
  master_plus: "master_plus",
  diamond_plus: "diamond_plus",
  emerald_plus: "emerald_plus",
  platinum_plus: "platinum_plus",
  gold_plus: "gold_plus",
  silver_plus: "silver_plus",
  overall: "overall",
};

export const LANE_MAP: Record<string, string> = {
  top: "top",
  jungle: "jungle",
  mid: "mid",
  bot: "adc",
  support: "support",
};
