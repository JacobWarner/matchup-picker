import { useState, useEffect, useCallback } from "react";
import type { Champion, Lane, MatchupResult } from "./types";
import { loadChampions } from "./champions";
import { fetchMatchup, fetchPatches } from "./api";
import ChampionPoolInput from "./components/ChampionPoolInput";
import LaneSelector from "./components/LaneSelector";
import RankDropdown from "./components/RankDropdown";
import PatchSelector from "./components/PatchSelector";
import EnemyInput from "./components/EnemyInput";
import ResultCard from "./components/ResultCard";

function getUrlParams(): {
  pool: string[];
  lane: Lane;
  rank: string;
  patch: string;
  enemy: string;
} {
  const params = new URLSearchParams(window.location.search);
  const pool = params.get("pool")?.split(",").filter(Boolean) ?? [];
  const lane = (params.get("lane") as Lane) ?? "top";
  const rank = params.get("rank") ?? "emerald_plus";
  const patch = params.get("patch") ?? "";
  const enemy = params.get("enemy") ?? "";
  return { pool, lane, rank, patch, enemy };
}

function setUrlParams(pool: string[], lane: string, rank: string, patch: string, enemy: string) {
  const params = new URLSearchParams();
  if (pool.length > 0) params.set("pool", pool.join(","));
  if (lane) params.set("lane", lane);
  if (rank) params.set("rank", rank);
  if (patch) params.set("patch", patch);
  if (enemy) params.set("enemy", enemy);
  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, "", newUrl);
}

export default function App() {
  const [allChampions, setAllChampions] = useState<Champion[]>([]);
  const [patches, setPatches] = useState<string[]>([]);
  const [pool, setPool] = useState<Champion[]>([]);
  const [lane, setLane] = useState<Lane>("top");
  const [rank, setRank] = useState("emerald_plus");
  const [patch, setPatch] = useState("");
  const [results, setResults] = useState<MatchupResult[] | null>(null);
  const [enemyName, setEnemyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [championsLoaded, setChampionsLoaded] = useState(false);

  // Load champions and patches on mount
  useEffect(() => {
    const params = getUrlParams();

    Promise.all([loadChampions(), fetchPatches()])
      .then(([champs, patchList]) => {
        setAllChampions(champs);
        setPatches(patchList);

        const restored = params.pool
          .map((name) => champs.find(
            (c) => c.id === name || c.name.toLowerCase() === name.toLowerCase()
          ))
          .filter((c): c is Champion => c !== undefined);
        setPool(restored);
        setLane(params.lane);
        setRank(params.rank);
        setPatch(params.patch || patchList[0] || "");
        setEnemyName(params.enemy);
        setChampionsLoaded(true);
      })
      .catch((err) => {
        setError(`Failed to load data: ${err instanceof Error ? err.message : "Unknown error"}`);
      });
  }, []);

  // Sync state to URL params
  useEffect(() => {
    if (!championsLoaded) return;
    setUrlParams(
      pool.map((c) => c.id),
      lane,
      rank,
      patch,
      enemyName
    );
  }, [pool, lane, rank, patch, enemyName, championsLoaded]);

  const handleAddChampion = useCallback((champ: Champion) => {
    setPool((prev) => {
      if (prev.length >= 5 || prev.some((c) => c.id === champ.id)) return prev;
      return [...prev, champ];
    });
  }, []);

  const handleRemoveChampion = useCallback((id: string) => {
    setPool((prev) => prev.filter((c) => c.id !== id));
  }, []);

  async function handleFindBestPick(enemy: Champion) {
    if (pool.length === 0) {
      setError("Add at least one champion to your pool.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);
    setEnemyName(enemy.name);

    try {
      const response = await fetchMatchup(
        pool.map((c) => c.id),
        enemy.id,
        lane,
        rank,
        patch
      );
      setResults(response.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (allChampions.length === 0) {
    return <div className="app-loading">Loading champion data...</div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>MATCHUP PICKER</h1>
        <p className="app-subtitle">
          Find the best champion from your pool for any matchup
        </p>
      </header>

      <main className="app-main">
        <ChampionPoolInput
          pool={pool}
          allChampions={allChampions}
          onAdd={handleAddChampion}
          onRemove={handleRemoveChampion}
        />

        <div className="lane-rank-row">
          <LaneSelector selected={lane} onChange={setLane} />
          <RankDropdown selected={rank} onChange={setRank} />
          {patches.length > 0 && (
            <PatchSelector patches={patches} selected={patch} onChange={setPatch} />
          )}
        </div>

        <EnemyInput
          allChampions={allChampions}
          onSubmit={handleFindBestPick}
          loading={loading}
        />

        {error && <div className="error-msg">{error}</div>}

        {results && (
          <div className="results">
            <div className="results-header">
              Results — Your Pool vs {enemyName} ({lane.toUpperCase()},{" "}
              {rank.replace("_", " ")}, Patch {patch.replace("_", ".")})
            </div>
            {results.map((r, i) => (
              <ResultCard
                key={r.championId}
                result={r}
                rank={i + 1}
                totalResults={results.length}
                allChampions={allChampions}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
