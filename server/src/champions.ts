export interface ChampionEntry {
  id: string;
  key: string;   // numeric champion key as a string, e.g. "122" for Darius
  name: string;
  image: { full: string };
}

export interface ChampionData {
  [id: string]: ChampionEntry;
}

export const CHAMPION_NAME_OVERRIDES: Record<string, string> = {
  MonkeyKing: "wukong",
};

export function toUggName(ddragonId: string): string {
  if (CHAMPION_NAME_OVERRIDES[ddragonId]) {
    return CHAMPION_NAME_OVERRIDES[ddragonId];
  }
  return ddragonId.toLowerCase();
}

export function normalizeChampionName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function toDisplayName(
  ddragonId: string,
  champions: ChampionData
): string {
  return champions[ddragonId]?.name ?? ddragonId;
}

export function iconUrl(ddragonId: string, version: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${ddragonId}.png`;
}

let cachedChampions: ChampionData | null = null;
let cachedVersion: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;
let fetchPromise: Promise<{ champions: ChampionData; version: string }> | null = null;

export function fetchChampions(): Promise<{
  champions: ChampionData;
  version: string;
}> {
  if (cachedChampions && cachedVersion && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return Promise.resolve({ champions: cachedChampions, version: cachedVersion });
  }

  if (!fetchPromise) {
    fetchPromise = doFetchChampions().finally(() => {
      fetchPromise = null;
    });
  }
  return fetchPromise;
}

async function doFetchChampions(): Promise<{ champions: ChampionData; version: string }> {
  const versionsRes = await fetch(
    "https://ddragon.leagueoflegends.com/api/versions.json"
  );
  if (!versionsRes.ok) {
    throw new Error(`Data Dragon versions endpoint returned HTTP ${versionsRes.status}`);
  }
  const versions: string[] = await versionsRes.json();
  if (!versions || versions.length === 0) {
    throw new Error("Data Dragon returned empty versions list");
  }
  const version = versions[0];

  const champRes = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`
  );
  if (!champRes.ok) {
    throw new Error(`Data Dragon champion data returned HTTP ${champRes.status}`);
  }
  const champJson = await champRes.json();

  cachedChampions = champJson.data as ChampionData;
  cachedVersion = version;
  cacheTimestamp = Date.now();
  return { champions: cachedChampions, version: cachedVersion };
}

export function findChampionId(
  input: string,
  champions: ChampionData
): string | null {
  if (champions[input]) return input;

  const byId = Object.keys(champions).find(
    (id) => id.toLowerCase() === input.toLowerCase()
  );
  if (byId) return byId;

  const byName = Object.values(champions).find(
    (c) => c.name.toLowerCase() === input.toLowerCase()
  );
  if (byName) return byName.id;

  return null;
}
