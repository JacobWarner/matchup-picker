import type { Champion } from "./types";

let cache: { champions: Champion[]; version: string } | null = null;
let loadPromise: Promise<Champion[]> | null = null;

/**
 * Load all champions from Riot Data Dragon. Promise-deduplicated so
 * concurrent calls (e.g. React StrictMode double-fire) share one fetch.
 */
export function loadChampions(): Promise<Champion[]> {
  if (cache) return Promise.resolve(cache.champions);
  if (!loadPromise) {
    loadPromise = doLoadChampions().finally(() => {
      loadPromise = null;
    });
  }
  return loadPromise;
}

async function doLoadChampions(): Promise<Champion[]> {
  const versionsRes = await fetch(
    "https://ddragon.leagueoflegends.com/api/versions.json"
  );
  if (!versionsRes.ok) {
    throw new Error(`Failed to load game version data (HTTP ${versionsRes.status})`);
  }
  const versions: string[] = await versionsRes.json();
  if (!versions || versions.length === 0) {
    throw new Error("Game version data was empty");
  }
  const version = versions[0];

  const champRes = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`
  );
  if (!champRes.ok) {
    throw new Error(`Failed to load champion data (HTTP ${champRes.status})`);
  }
  const data = await champRes.json();

  const champions: Champion[] = Object.values(data.data).map((c: any) => ({
    id: c.id,
    name: c.name,
    image: `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${c.image.full}`,
  }));

  champions.sort((a, b) => a.name.localeCompare(b.name));
  cache = { champions, version };
  return champions;
}

export function searchChampions(
  champions: Champion[],
  query: string
): Champion[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return champions
    .filter((c) => c.name.toLowerCase().includes(q))
    .slice(0, 8);
}

export function getIconUrl(champions: Champion[], id: string): string {
  return champions.find((c) => c.id === id)?.image ?? "";
}
