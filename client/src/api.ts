import type { MatchupResponse } from "./types";

export async function fetchMatchup(
  pool: string[],
  enemy: string,
  lane: string,
  rank: string,
  patch?: string
): Promise<MatchupResponse> {
  const body: Record<string, unknown> = { pool, enemy, lane, rank };
  if (patch) body.patch = patch;

  const res = await fetch("/api/matchup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

export async function fetchPatches(): Promise<string[]> {
  const res = await fetch("/api/patches");
  if (!res.ok) {
    throw new Error(`Failed to load patches (HTTP ${res.status})`);
  }
  return res.json();
}
