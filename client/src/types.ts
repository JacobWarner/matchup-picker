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

export interface MatchupResponse {
  enemy: string;
  lane: string;
  rank: string;
  results: MatchupResult[];
}

export interface Champion {
  id: string;
  name: string;
  image: string;
}

export const LANES = ["top", "jungle", "mid", "bot", "support"] as const;
export type Lane = (typeof LANES)[number];

export const RANKS = [
  { label: "Iron", value: "iron" },
  { label: "Bronze", value: "bronze" },
  { label: "Silver", value: "silver" },
  { label: "Gold", value: "gold" },
  { label: "Platinum", value: "platinum" },
  { label: "Emerald", value: "emerald" },
  { label: "Diamond", value: "diamond" },
  { label: "Master", value: "master" },
  { label: "Grandmaster", value: "grandmaster" },
  { label: "Challenger", value: "challenger" },
  { label: "Platinum+", value: "platinum_plus" },
  { label: "Emerald+", value: "emerald_plus" },
  { label: "Diamond+", value: "diamond_plus" },
  { label: "Master+", value: "master_plus" },
  { label: "Overall", value: "overall" },
] as const;

export const LANE_LABELS: Record<Lane, string> = {
  top: "TOP",
  jungle: "JG",
  mid: "MID",
  bot: "BOT",
  support: "SUP",
};
