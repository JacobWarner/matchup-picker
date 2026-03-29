import type { MatchupResponse } from "./types";

export async function fetchMatchup(
  pool: string[],
  enemy: string,
  lane: string,
  rank: string
): Promise<MatchupResponse> {
  const res = await fetch("/api/matchup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pool, enemy, lane, rank }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}
