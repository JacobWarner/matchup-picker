# Champion Matchup Picker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web app that recommends the best champion from a user's pool for a given matchup, using scraped u.gg data.

**Architecture:** React+Vite frontend sends pool/enemy/lane/rank to an Express+Playwright backend. Backend scrapes u.gg counter and build pages in parallel, parses matchup stats, returns ranked JSON. All state lives in URL params.

**Tech Stack:** React, TypeScript, Vite, Node.js, Express, Playwright, npm workspaces, Riot Data Dragon CDN

---

## File Structure

```
TylerPrototype/
├── package.json                          # Root workspace config
├── tsconfig.base.json                    # Shared TS settings
├── client/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx                      # Entry point
│       ├── App.tsx                       # Root component, URL param sync
│       ├── types.ts                      # Shared frontend types
│       ├── api.ts                        # API call to backend
│       ├── champions.ts                  # Data Dragon fetch, search, icon URLs
│       ├── components/
│       │   ├── ChampionPoolInput.tsx     # Pool management with autocomplete
│       │   ├── LaneSelector.tsx          # Lane toggle buttons
│       │   ├── RankDropdown.tsx          # Rank preset dropdown
│       │   ├── EnemyInput.tsx            # Enemy champion search
│       │   └── ResultCard.tsx            # Single result card display
│       └── App.css                       # Styles
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                      # Express server entry
│       ├── types.ts                      # Shared backend types
│       ├── routes/
│       │   └── matchup.ts               # POST /api/matchup handler
│       ├── scraper/
│       │   ├── browser.ts               # Playwright browser lifecycle (singleton with anti-detection)
│       │   ├── throttle.ts              # Concurrency limiter for scrape requests
│       │   ├── counterPage.ts           # Scrape enemy counter page (WR, GD@15, games)
│       │   ├── buildPage.ts             # Scrape pool champ build pages (tier, pick%, ban%)
│       │   └── parseUtils.ts            # Text parsing helpers (extract WR, games, GD@15)
│       └── champions.ts                 # DDragon champion name mapping + u.gg URL conversion
└── server/tests/
    ├── parseUtils.test.ts               # Unit tests for text parsing
    ├── counterPage.test.ts              # Unit tests for counter page data extraction
    ├── buildPage.test.ts                # Unit tests for build page data extraction
    └── champions.test.ts                # Unit tests for champion name conversion
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.base.json`
- Create: `client/package.json`, `client/tsconfig.json`, `client/vite.config.ts`, `client/index.html`, `client/src/main.tsx`
- Create: `server/package.json`, `server/tsconfig.json`, `server/src/index.ts`

- [ ] **Step 1: Create root package.json with workspaces**

```json
{
  "name": "champion-matchup-picker",
  "private": true,
  "workspaces": ["client", "server"]
}
```

- [ ] **Step 2: Create shared TypeScript base config**

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

- [ ] **Step 3: Create client package.json and configs**

`client/package.json`:
```json
{
  "name": "client",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^4.4.1",
    "typescript": "^5.8.3",
    "vite": "^6.3.4"
  }
}
```

`client/tsconfig.json`:
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

`client/vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
```

`client/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Matchup Picker</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`client/src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./App.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

`client/src/App.tsx` (placeholder):
```tsx
export default function App() {
  return <div>Matchup Picker</div>;
}
```

`client/src/App.css` (empty for now):
```css
```

- [ ] **Step 4: Create server package.json and configs**

`server/package.json`:
```json
{
  "name": "server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^5.1.0",
    "playwright": "^1.52.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.2",
    "tsx": "^4.19.4",
    "typescript": "^5.8.3",
    "vitest": "^3.1.3"
  }
}
```

`server/tsconfig.json`:
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src", "tests"]
}
```

`server/src/index.ts` (minimal server):
```ts
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

- [ ] **Step 5: Install dependencies**

Run: `npm install` (from root)
Then: `cd server && npx playwright install chromium`

- [ ] **Step 6: Verify both client and server start**

Terminal 1: `cd server && npm run dev` — should show "Server running on port 3001"
Terminal 2: `cd client && npm run dev` — should show Vite dev server URL
Visit client URL — should show "Matchup Picker"
Visit `http://localhost:3001/api/health` — should return `{"status":"ok"}`

- [ ] **Step 7: Commit**

```bash
git init
echo "node_modules/\ndist/\n.superpowers/" > .gitignore
git add .
git commit -m "feat: scaffold monorepo with React client and Express server"
```

---

## Task 2: Champion Name Utilities (Data Dragon + u.gg Mapping)

**Files:**
- Create: `server/src/champions.ts`
- Create: `server/tests/champions.test.ts`

- [ ] **Step 1: Write failing tests for champion name conversion**

`server/tests/champions.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toUggName, toDisplayName, CHAMPION_NAME_OVERRIDES } from "../src/champions.js";

describe("toUggName", () => {
  it("lowercases simple names", () => {
    expect(toUggName("Darius")).toBe("darius");
  });

  it("lowercases multi-word DDragon IDs", () => {
    expect(toUggName("MissFortune")).toBe("missfortune");
    expect(toUggName("DrMundo")).toBe("drmundo");
    expect(toUggName("LeeSin")).toBe("leesin");
  });

  it("handles MonkeyKing -> wukong special case", () => {
    expect(toUggName("MonkeyKing")).toBe("wukong");
  });
});

describe("toDisplayName", () => {
  it("returns display name from DDragon data", () => {
    const champions = {
      Darius: { id: "Darius", name: "Darius" },
      MonkeyKing: { id: "MonkeyKing", name: "Wukong" },
      MissFortune: { id: "MissFortune", name: "Miss Fortune" },
    };
    expect(toDisplayName("Darius", champions)).toBe("Darius");
    expect(toDisplayName("MonkeyKing", champions)).toBe("Wukong");
    expect(toDisplayName("MissFortune", champions)).toBe("Miss Fortune");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run tests/champions.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement champion name utilities**

`server/src/champions.ts`:
```ts
export interface ChampionEntry {
  id: string;
  key: string;
  name: string;
  image: { full: string };
}

export interface ChampionData {
  [id: string]: ChampionEntry;
}

// Special cases where DDragon ID doesn't match u.gg URL slug
export const CHAMPION_NAME_OVERRIDES: Record<string, string> = {
  MonkeyKing: "wukong",
};

export function toUggName(ddragonId: string): string {
  if (CHAMPION_NAME_OVERRIDES[ddragonId]) {
    return CHAMPION_NAME_OVERRIDES[ddragonId];
  }
  return ddragonId.toLowerCase();
}

/**
 * Normalize a champion name for fuzzy matching across DDragon/u.gg display names.
 * Strips all non-alphanumeric chars and lowercases.
 * e.g. "Miss Fortune" -> "missfortune", "Dr. Mundo" -> "drmundo"
 */
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
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — refreshes on new patches
let fetchPromise: Promise<{ champions: ChampionData; version: string }> | null = null;

export function fetchChampions(): Promise<{
  champions: ChampionData;
  version: string;
}> {
  // Return cache if fresh
  if (cachedChampions && cachedVersion && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return Promise.resolve({ champions: cachedChampions, version: cachedVersion });
  }

  // Deduplicate concurrent calls (prevents race on startup)
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
  // Exact match on ID
  if (champions[input]) return input;

  // Case-insensitive match on ID
  const byId = Object.keys(champions).find(
    (id) => id.toLowerCase() === input.toLowerCase()
  );
  if (byId) return byId;

  // Match on display name
  const byName = Object.values(champions).find(
    (c) => c.name.toLowerCase() === input.toLowerCase()
  );
  if (byName) return byName.id;

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run tests/champions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/champions.ts server/tests/champions.test.ts
git commit -m "feat: add champion name utilities for DDragon and u.gg mapping"
```

---

## Task 3: Text Parsing Helpers

**Files:**
- Create: `server/src/scraper/parseUtils.ts`
- Create: `server/tests/parseUtils.test.ts`

- [ ] **Step 1: Write failing tests for text parsers**

`server/tests/parseUtils.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseWinRate, parseGames, parseGoldDiff } from "../src/scraper/parseUtils.js";

describe("parseWinRate", () => {
  it("extracts winrate from '55.56% WR'", () => {
    expect(parseWinRate("55.56% WR")).toBe(55.56);
  });

  it("extracts winrate from '49.43%'", () => {
    expect(parseWinRate("49.43%")).toBe(49.43);
  });

  it("returns null for invalid input", () => {
    expect(parseWinRate("no data")).toBeNull();
  });
});

describe("parseGames", () => {
  it("extracts games from '2,124 games'", () => {
    expect(parseGames("2,124 games")).toBe(2124);
  });

  it("extracts games from '107,494'", () => {
    expect(parseGames("107,494")).toBe(107494);
  });

  it("extracts games from '629 games'", () => {
    expect(parseGames("629 games")).toBe(629);
  });

  it("returns null for invalid input", () => {
    expect(parseGames("N/A")).toBeNull();
  });
});

describe("parseGoldDiff", () => {
  it("extracts positive gold diff from '+655 GD15'", () => {
    expect(parseGoldDiff("+655 GD15")).toBe(655);
  });

  it("extracts negative gold diff from '-210 GD15'", () => {
    expect(parseGoldDiff("-210 GD15")).toBe(-210);
  });

  it("returns null for invalid input", () => {
    expect(parseGoldDiff("no data")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run tests/parseUtils.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement text parsers**

`server/src/scraper/parseUtils.ts`:
```ts
export function parseWinRate(text: string): number | null {
  const match = text.match(/([\d.]+)%/);
  return match ? parseFloat(match[1]) : null;
}

export function parseGames(text: string): number | null {
  const match = text.match(/([\d,]+)/);
  return match ? parseInt(match[1].replace(/,/g, ""), 10) : null;
}

export function parseGoldDiff(text: string): number | null {
  const match = text.match(/([+-]?\d+)\s*GD/i);
  return match ? parseInt(match[1], 10) : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run tests/parseUtils.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/scraper/parseUtils.ts server/tests/parseUtils.test.ts
git commit -m "feat: add text parsing helpers for WR, games, and GD@15"
```

---

## Task 4: Playwright Browser Lifecycle + Request Throttle

**Files:**
- Create: `server/src/scraper/browser.ts`
- Create: `server/src/scraper/throttle.ts`

- [ ] **Step 1: Implement race-safe browser singleton with anti-detection**

`server/src/scraper/browser.ts`:
```ts
import { chromium, Browser, BrowserContext } from "playwright";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Promise-based singleton prevents race conditions on concurrent startup
let browserPromise: Promise<Browser> | null = null;

export function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium
      .launch({
        headless: true,
        args: ["--disable-blink-features=AutomationControlled"],
      })
      .catch((err) => {
        browserPromise = null; // reset so next call retries
        throw err;
      });
  }
  return browserPromise;
}

/**
 * Creates an isolated browser context with a realistic user-agent.
 * Each scrape operation should use its own context for cookie/state isolation.
 * The caller is responsible for closing the context when done.
 */
export async function createContext(): Promise<BrowserContext> {
  const browser = await getBrowser();
  return browser.newContext({ userAgent: USER_AGENT });
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise;
    browserPromise = null;
    await browser.close();
  }
}
```

- [ ] **Step 2: Implement request throttle to avoid u.gg rate limiting**

`server/src/scraper/throttle.ts`:
```ts
/**
 * Simple concurrency limiter to prevent overwhelming u.gg with parallel requests.
 * Limits to MAX_CONCURRENT pages open at once and adds a small delay between acquisitions.
 */
const MAX_CONCURRENT = 3;
const DELAY_MS = 300; // ms between releasing a slot and the next acquire

let active = 0;
const queue: Array<() => void> = [];

function acquire(): Promise<void> {
  return new Promise((resolve) => {
    if (active < MAX_CONCURRENT) {
      active++;
      resolve();
    } else {
      queue.push(resolve);
    }
  });
}

function release(): void {
  // Small delay before allowing next request to avoid burst patterns
  setTimeout(() => {
    if (queue.length > 0) {
      const next = queue.shift()!;
      next();
    } else {
      active--;
    }
  }, DELAY_MS);
}

/**
 * Run a scraping function with concurrency throttling.
 * At most MAX_CONCURRENT scrape operations run simultaneously.
 */
export async function withThrottle<T>(fn: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add server/src/scraper/browser.ts server/src/scraper/throttle.ts
git commit -m "feat: add race-safe browser singleton with anti-detection and request throttle"
```

---

## Task 5: Counter Page Scraper

**Files:**
- Create: `server/src/scraper/counterPage.ts`
- Create: `server/src/types.ts`

- [ ] **Step 1: Define shared types**

`server/src/types.ts`:
```ts
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

// Maps frontend rank keys to u.gg URL rank values.
// Frontend sends keys like "emerald_plus"; u.gg URLs use the same format.
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

// Maps frontend lane keys to u.gg URL role values.
// NOTE: u.gg uses "adc" in URLs for the bot lane role. Verify during smoke testing
// and update if u.gg has changed to "bot".
export const LANE_MAP: Record<string, string> = {
  top: "top",
  jungle: "jungle",
  mid: "mid",
  bot: "adc",
  support: "support",
};
```

- [ ] **Step 2: Implement counter page scraper**

`server/src/scraper/counterPage.ts`:
```ts
import { createContext } from "./browser.js";
import { withThrottle } from "./throttle.js";
import { parseWinRate, parseGames, parseGoldDiff } from "./parseUtils.js";
import { normalizeChampionName } from "../champions.js";

export interface CounterPageData {
  /** normalized champion name -> matchup stats */
  [normalizedName: string]: {
    winRate: number | null;
    gamesPlayed: number | null;
    goldDiff15: number | null;
  };
}

/**
 * Scrapes the enemy's counter page and extracts matchup data for all listed champions.
 * We scrape the enemy's page because it lists all champions with their WR against the enemy.
 *
 * URL: https://u.gg/lol/champions/{enemy}/counter?role={lane}&rank={rank}
 *
 * Expected HTML structure (as of 2026-03-29):
 * - Counter rows are <a> tags with href containing "/lol/champions/" and "/build"
 * - Each row has: champion name (bold truncated text), stat value ("55.56% WR" or "+655 GD15"), game count ("2,124 games")
 * - Three sections: "Best Picks vs", "Worst Picks vs", "Best Lane Counters vs"
 */
export async function scrapeCounterPage(
  enemyUggName: string,
  lane: string,
  rank: string
): Promise<CounterPageData> {
  return withThrottle(async () => {
    const context = await createContext();

    try {
      const page = await context.newPage();
      const url = `https://u.gg/lol/champions/${enemyUggName}/counter?role=${lane}&rank=${rank}`;

      // Navigate and check response status
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

      if (!response) {
        throw new Error(`No response from u.gg counter page for ${enemyUggName}`);
      }
      if (response.status() === 403 || response.status() === 429) {
        throw new Error(`u.gg returned HTTP ${response.status()} — likely rate limited or blocked`);
      }
      if (response.status() === 503) {
        throw new Error("u.gg is temporarily unavailable (503)");
      }
      if (response.status() >= 400) {
        throw new Error(`u.gg returned HTTP ${response.status()} for ${enemyUggName}`);
      }

      // Check for Cloudflare/bot detection challenge pages
      const title = await page.title();
      if (title.includes("Just a moment") || title.includes("Attention Required")) {
        throw new Error("u.gg bot detection triggered — CAPTCHA/challenge page returned");
      }

      // Wait for the actual counter data to render (not just DOM load)
      try {
        await page.waitForSelector('a[href*="/lol/champions/"][href*="/build"]', { timeout: 10000 });
      } catch {
        throw new Error(
          `Counter page for ${enemyUggName} did not render expected content within 10s. ` +
          "u.gg's page structure may have changed."
        );
      }

      // Extract data from all three sections
      const data = await page.evaluate(() => {
        const results: Record<
          string,
          { winRate: string | null; gamesPlayed: string | null; goldDiff15: string | null }
        > = {};

        const rows = document.querySelectorAll(
          'a[href*="/lol/champions/"][href*="/build"]'
        );

        for (const row of rows) {
          const nameEl = row.querySelector(
            'div[class*="font-bold"][class*="truncate"]'
          );
          if (!nameEl) continue;
          const name = nameEl.textContent?.trim() ?? "";
          if (!name) continue;

          const statDivs = row.querySelectorAll(
            'div[class*="text-[12px]"][class*="font-bold"]'
          );
          const gameDivs = row.querySelectorAll(
            'div[class*="text-[11px]"]'
          );

          const statText = statDivs[0]?.textContent?.trim() ?? "";
          const gameText = gameDivs[0]?.textContent?.trim() ?? "";

          if (!results[name]) {
            results[name] = { winRate: null, gamesPlayed: null, goldDiff15: null };
          }

          if (statText.includes("WR")) {
            results[name].winRate = statText;
            results[name].gamesPlayed = gameText;
          } else if (statText.includes("GD")) {
            results[name].goldDiff15 = statText;
            if (!results[name].gamesPlayed) {
              results[name].gamesPlayed = gameText;
            }
          }
        }

        return results;
      });

      // Validate we got some data (if zero rows, page structure likely changed)
      if (Object.keys(data).length === 0) {
        throw new Error(
          "Counter page returned zero champion rows. u.gg's page structure may have changed."
        );
      }

      // Parse raw text into numbers, keyed by normalized name for reliable matching
      const parsed: CounterPageData = {};
      for (const [name, raw] of Object.entries(data)) {
        parsed[normalizeChampionName(name)] = {
          winRate: raw.winRate ? parseWinRate(raw.winRate) : null,
          gamesPlayed: raw.gamesPlayed ? parseGames(raw.gamesPlayed) : null,
          goldDiff15: raw.goldDiff15 ? parseGoldDiff(raw.goldDiff15) : null,
        };
      }

      return parsed;
    } finally {
      await context.close(); // closes all pages in this context
    }
  });
}

// Local copies of parse functions — page.evaluate runs in browser context
// and cannot access Node.js imports. These are used OUTSIDE page.evaluate
// on the raw text strings extracted from the browser.
function parseWinRate(text: string): number | null {
  const match = text.match(/([\d.]+)%/);
  return match ? parseFloat(match[1]) : null;
}

function parseGames(text: string): number | null {
  const match = text.match(/([\d,]+)/);
  return match ? parseInt(match[1].replace(/,/g, ""), 10) : null;
}

function parseGoldDiff(text: string): number | null {
  const match = text.match(/([+-]?\d+)\s*GD/i);
  return match ? parseInt(match[1], 10) : null;
}
```

- [ ] **Step 3: Commit**

```bash
git add server/src/types.ts server/src/scraper/counterPage.ts
git commit -m "feat: add counter page scraper for matchup WR, GD@15, and games"
```

---

## Task 6: Build Page Scraper

**Files:**
- Create: `server/src/scraper/buildPage.ts`

- [ ] **Step 1: Implement build page scraper**

`server/src/scraper/buildPage.ts`:
```ts
import { createContext } from "./browser.js";
import { withThrottle } from "./throttle.js";

export interface BuildPageData {
  tier: string | null;
  pickRate: number | null;
  banRate: number | null;
}

/**
 * Scrapes a champion's build page to get overall meta stats (tier, pick rate, ban rate).
 *
 * URL: https://u.gg/lol/champions/{champion}/build?role={lane}&rank={rank}
 *
 * Expected HTML structure (as of 2026-03-29):
 * - Stats bar is a 6-column grid with cells containing a value div and label div
 * - Labels: "Tier", "Win Rate", "Rank", "Pick Rate", "Ban Rate", "Matches"
 * - We extract by matching label text, not by position (resilient to reordering)
 */
export async function scrapeBuildPage(
  championUggName: string,
  lane: string,
  rank: string
): Promise<BuildPageData> {
  return withThrottle(async () => {
    const context = await createContext();

    try {
      const page = await context.newPage();
      const url = `https://u.gg/lol/champions/${championUggName}/build?role=${lane}&rank=${rank}`;

      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

      if (!response) {
        throw new Error(`No response from u.gg build page for ${championUggName}`);
      }
      if (response.status() === 403 || response.status() === 429) {
        throw new Error(`u.gg returned HTTP ${response.status()} — likely rate limited or blocked`);
      }
      if (response.status() === 503) {
        throw new Error("u.gg is temporarily unavailable (503)");
      }
      if (response.status() >= 400) {
        throw new Error(`u.gg returned HTTP ${response.status()} for ${championUggName}`);
      }

      const title = await page.title();
      if (title.includes("Just a moment") || title.includes("Attention Required")) {
        throw new Error("u.gg bot detection triggered — CAPTCHA/challenge page returned");
      }

      // Wait for the stats grid to render
      try {
        await page.waitForSelector('div[class*="grid"]', { timeout: 10000 });
      } catch {
        throw new Error(
          `Build page for ${championUggName} did not render stats grid within 10s. ` +
          "u.gg's page structure may have changed."
        );
      }

      const data = await page.evaluate(() => {
        const cells = document.querySelectorAll('div[class*="grid"] > div');

        let tier: string | null = null;
        let pickRate: string | null = null;
        let banRate: string | null = null;

        for (const cell of cells) {
          const labels = cell.querySelectorAll('div[class*="text-[12px]"]');
          const values = cell.querySelectorAll('div[class*="text-[20px]"]');

          if (labels.length === 0 || values.length === 0) continue;

          const label = labels[0].textContent?.trim() ?? "";
          const value = values[0].textContent?.trim() ?? "";

          if (label === "Tier") tier = value;
          else if (label === "Pick Rate") pickRate = value;
          else if (label === "Ban Rate") banRate = value;
        }

        return { tier, pickRate, banRate };
      });

      return {
        tier: data.tier,
        pickRate: data.pickRate ? parsePercent(data.pickRate) : null,
        banRate: data.banRate ? parsePercent(data.banRate) : null,
      };
    } finally {
      await context.close();
    }
  });
}

function parsePercent(text: string): number | null {
  const match = text.match(/([\d.]+)%/);
  return match ? parseFloat(match[1]) : null;
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/scraper/buildPage.ts
git commit -m "feat: add build page scraper for tier, pick rate, and ban rate"
```

---

## Task 7: API Endpoint — POST /api/matchup

**Files:**
- Create: `server/src/routes/matchup.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Implement matchup route**

`server/src/routes/matchup.ts`:
```ts
import { Router, Request, Response } from "express";
import { scrapeCounterPage } from "../scraper/counterPage.js";
import { scrapeBuildPage } from "../scraper/buildPage.js";
import {
  fetchChampions,
  findChampionId,
  toUggName,
  normalizeChampionName,
} from "../champions.js";
import {
  MatchupRequest,
  MatchupResponse,
  MatchupResult,
  LANE_MAP,
  RANK_MAP,
} from "../types.js";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const { pool, enemy, lane, rank } = req.body as MatchupRequest;

    // Validate inputs — check types at runtime since `as` is compile-time only
    if (!pool || !Array.isArray(pool) || pool.length === 0) {
      res.status(400).json({ error: "pool must be a non-empty array" });
      return;
    }
    if (pool.length > 5) {
      res.status(400).json({ error: "pool cannot exceed 5 champions" });
      return;
    }
    if (!pool.every((p: unknown) => typeof p === "string" && p.length > 0 && p.length < 50)) {
      res.status(400).json({ error: "pool must contain only non-empty champion name strings" });
      return;
    }
    if (!enemy || typeof enemy !== "string") {
      res.status(400).json({ error: "enemy is required" });
      return;
    }
    if (!lane || !LANE_MAP[lane]) {
      res.status(400).json({ error: `invalid lane: ${lane}. Valid: ${Object.keys(LANE_MAP).join(", ")}` });
      return;
    }
    if (!rank || !RANK_MAP[rank]) {
      res.status(400).json({ error: `invalid rank: ${rank}. Valid: ${Object.keys(RANK_MAP).join(", ")}` });
      return;
    }

    const { champions } = await fetchChampions();

    // Resolve champion IDs
    const enemyId = findChampionId(enemy, champions);
    if (!enemyId) {
      res.status(400).json({ error: `unknown champion: ${enemy}` });
      return;
    }

    const poolIds: string[] = [];
    for (const name of pool) {
      const id = findChampionId(name, champions);
      if (id) poolIds.push(id);
    }

    if (poolIds.length === 0) {
      res.status(400).json({ error: "no valid champions in pool" });
      return;
    }

    const uggLane = LANE_MAP[lane];
    const uggRank = RANK_MAP[rank];
    const enemyUggName = toUggName(enemyId);

    // Scrape in parallel (throttled): 1 counter page + N build pages
    // The throttle in scraper/throttle.ts limits concurrency to avoid triggering u.gg rate limits
    const [counterData, ...buildResults] = await Promise.all([
      scrapeCounterPage(enemyUggName, uggLane, uggRank),
      ...poolIds.map((id) => scrapeBuildPage(toUggName(id), uggLane, uggRank)),
    ]);

    // Assemble results — use normalized names for reliable matching
    // across DDragon display names and u.gg display names
    const results: MatchupResult[] = poolIds.map((id, i) => {
      const champName = champions[id].name;
      const normalized = normalizeChampionName(champName);
      const counter = counterData[normalized] ?? null;
      const build = buildResults[i];
      const gamesPlayed = counter?.gamesPlayed ?? null;

      return {
        champion: champName,
        championId: id,
        winRate: counter?.winRate ?? null,
        goldDiff15: counter?.goldDiff15 ?? null,
        gamesPlayed,
        tier: build.tier,
        pickRate: build.pickRate,
        banRate: build.banRate,
        confidence:
          gamesPlayed === null
            ? "no-data"
            : gamesPlayed >= 500
              ? "high"
              : "low",
      };
    });

    // Sort by winrate descending (nulls last)
    results.sort((a, b) => {
      if (a.winRate === null && b.winRate === null) return 0;
      if (a.winRate === null) return 1;
      if (b.winRate === null) return -1;
      return b.winRate - a.winRate;
    });

    const response: MatchupResponse = {
      enemy: champions[enemyId].name,
      lane,
      rank,
      results,
    };

    res.json(response);
  } catch (err) {
    console.error("Matchup error:", err);

    // Surface scraping-specific errors to the client
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("rate limited") || message.includes("bot detection")) {
      res.status(429).json({ error: message });
    } else if (message.includes("page structure may have changed")) {
      res.status(502).json({ error: message });
    } else {
      res.status(500).json({ error: "Failed to fetch matchup data. Try again later." });
    }
  }
});

export default router;
```

- [ ] **Step 2: Wire route into Express server**

Replace `server/src/index.ts`:
```ts
import express from "express";
import cors from "cors";
import matchupRouter from "./routes/matchup.js";
import { closeBrowser } from "./scraper/browser.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/matchup", matchupRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown — close Playwright browser so Chromium isn't orphaned
async function shutdown() {
  console.log("Shutting down...");
  await closeBrowser();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
```

- [ ] **Step 3: Manual smoke test**

Start server: `cd server && npm run dev`
Test with curl:
```bash
curl -X POST http://localhost:3001/api/matchup \
  -H "Content-Type: application/json" \
  -d '{"pool":["Darius","Aatrox"],"enemy":"Teemo","lane":"top","rank":"emerald_plus"}'
```
Expected: JSON response with results array containing Darius and Aatrox matchup data.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/matchup.ts server/src/index.ts
git commit -m "feat: add POST /api/matchup endpoint with parallel scraping"
```

---

## Task 8: Frontend — Shared Types and API Client

**Files:**
- Create: `client/src/types.ts`
- Create: `client/src/api.ts`
- Create: `client/src/champions.ts`

- [ ] **Step 1: Define frontend types**

`client/src/types.ts`:
```ts
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
  { label: "Silver+", value: "silver_plus" },
  { label: "Gold+", value: "gold_plus" },
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
```

- [ ] **Step 2: Create API client**

`client/src/api.ts`:
```ts
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
```

- [ ] **Step 3: Create Data Dragon champion loader**

`client/src/champions.ts`:
```ts
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
```

- [ ] **Step 4: Commit**

```bash
git add client/src/types.ts client/src/api.ts client/src/champions.ts
git commit -m "feat: add frontend types, API client, and Data Dragon champion loader"
```

---

## Task 9: Frontend — ChampionPoolInput Component

**Files:**
- Create: `client/src/components/ChampionPoolInput.tsx`

- [ ] **Step 1: Implement champion pool input with autocomplete**

`client/src/components/ChampionPoolInput.tsx`:
```tsx
import { useState, useRef, useEffect } from "react";
import type { Champion } from "../types";
import { searchChampions } from "../champions";

interface Props {
  pool: Champion[];
  allChampions: Champion[];
  onAdd: (champion: Champion) => void;
  onRemove: (championId: string) => void;
}

export default function ChampionPoolInput({
  pool,
  allChampions,
  onAdd,
  onRemove,
}: Props) {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const results = searchChampions(allChampions, query).filter(
    (c) => !pool.some((p) => p.id === c.id)
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(champ: Champion) {
    if (pool.length >= 5) return;
    onAdd(champ);
    setQuery("");
    setShowDropdown(false);
  }

  return (
    <div className="pool-input">
      <label className="label">Your Champion Pool</label>
      <div className="pool-tags">
        {pool.map((c) => (
          <span key={c.id} className="pool-tag">
            <img src={c.image} alt={c.name} className="pool-tag-icon" />
            {c.name}
            <button
              className="pool-tag-remove"
              onClick={() => onRemove(c.id)}
            >
              ×
            </button>
          </span>
        ))}
        {pool.length < 5 && (
          <div className="pool-add-wrapper">
            <input
              ref={inputRef}
              className="pool-add-input"
              placeholder="+ Add Champion"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => query && setShowDropdown(true)}
            />
            {showDropdown && results.length > 0 && (
              <div ref={dropdownRef} className="pool-dropdown">
                {results.map((c) => (
                  <button
                    key={c.id}
                    className="pool-dropdown-item"
                    onClick={() => handleSelect(c)}
                  >
                    <img src={c.image} alt={c.name} className="pool-tag-icon" />
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/ChampionPoolInput.tsx
git commit -m "feat: add ChampionPoolInput component with autocomplete"
```

---

## Task 10: Frontend — LaneSelector and RankDropdown Components

**Files:**
- Create: `client/src/components/LaneSelector.tsx`
- Create: `client/src/components/RankDropdown.tsx`

- [ ] **Step 1: Implement lane selector**

`client/src/components/LaneSelector.tsx`:
```tsx
import { LANES, LANE_LABELS, type Lane } from "../types";

interface Props {
  selected: Lane;
  onChange: (lane: Lane) => void;
}

export default function LaneSelector({ selected, onChange }: Props) {
  return (
    <div className="lane-selector">
      <label className="label">Lane</label>
      <div className="lane-buttons">
        {LANES.map((lane) => (
          <button
            key={lane}
            className={`lane-btn ${selected === lane ? "lane-btn-active" : ""}`}
            onClick={() => onChange(lane)}
          >
            {LANE_LABELS[lane]}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement rank dropdown**

`client/src/components/RankDropdown.tsx`:
```tsx
import { RANKS } from "../types";

interface Props {
  selected: string;
  onChange: (rank: string) => void;
}

export default function RankDropdown({ selected, onChange }: Props) {
  return (
    <div className="rank-dropdown">
      <label className="label">Rank</label>
      <select
        className="rank-select"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
      >
        {RANKS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/LaneSelector.tsx client/src/components/RankDropdown.tsx
git commit -m "feat: add LaneSelector and RankDropdown components"
```

---

## Task 11: Frontend — EnemyInput Component

**Files:**
- Create: `client/src/components/EnemyInput.tsx`

- [ ] **Step 1: Implement enemy input with autocomplete**

`client/src/components/EnemyInput.tsx`:
```tsx
import { useState, useRef, useEffect } from "react";
import type { Champion } from "../types";
import { searchChampions } from "../champions";

interface Props {
  allChampions: Champion[];
  onSubmit: (champion: Champion) => void;
  loading: boolean;
}

export default function EnemyInput({ allChampions, onSubmit, loading }: Props) {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState<Champion | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const results = searchChampions(allChampions, query);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(champ: Champion) {
    setSelected(champ);
    setQuery(champ.name);
    setShowDropdown(false);
  }

  function handleSubmit() {
    if (selected) {
      onSubmit(selected);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && selected) {
      handleSubmit();
    }
  }

  return (
    <div className="enemy-input">
      <label className="label">Enemy Champion</label>
      <div className="enemy-row">
        <div className="enemy-search-wrapper">
          <input
            ref={inputRef}
            className="enemy-search"
            placeholder="Search champion..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
              setShowDropdown(true);
            }}
            onFocus={() => query && setShowDropdown(true)}
            onKeyDown={handleKeyDown}
          />
          {showDropdown && results.length > 0 && (
            <div ref={dropdownRef} className="pool-dropdown">
              {results.map((c) => (
                <button
                  key={c.id}
                  className="pool-dropdown-item"
                  onClick={() => handleSelect(c)}
                >
                  <img src={c.image} alt={c.name} className="pool-tag-icon" />
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          className="find-btn"
          onClick={handleSubmit}
          disabled={!selected || loading}
        >
          {loading ? "Loading..." : "Find Best Pick"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/EnemyInput.tsx
git commit -m "feat: add EnemyInput component with autocomplete and submit"
```

---

## Task 12: Frontend — ResultCard Component

**Files:**
- Create: `client/src/components/ResultCard.tsx`

- [ ] **Step 1: Implement result card**

`client/src/components/ResultCard.tsx`:
```tsx
import type { MatchupResult, Champion } from "../types";

interface Props {
  result: MatchupResult;
  rank: number;
  totalResults: number;
  allChampions: Champion[];
}

export default function ResultCard({
  result,
  rank,
  totalResults,
  allChampions,
}: Props) {
  const isBest = rank === 1;
  const isWorst = rank === totalResults && totalResults > 1;
  const icon = allChampions.find((c) => c.id === result.championId)?.image;

  const cardClass = isBest
    ? "result-card result-card-best"
    : isWorst
      ? "result-card result-card-worst"
      : "result-card";

  function formatGd(gd: number | null): string {
    if (gd === null) return "—";
    return gd > 0 ? `+${gd}` : `${gd}`;
  }

  function formatGames(g: number | null): string {
    if (g === null) return "—";
    if (g >= 1000) return `${(g / 1000).toFixed(1)}k`;
    return `${g}`;
  }

  return (
    <div className={cardClass}>
      <div className="result-left">
        <div className={`result-rank ${isBest ? "result-rank-best" : ""}`}>
          #{rank}
        </div>
        {icon && <img src={icon} alt={result.champion} className="result-icon" />}
        <div>
          <div className="result-name">{result.champion}</div>
          {isBest && <div className="result-label-best">BEST PICK</div>}
          {isWorst && <div className="result-label-worst">WORST PICK</div>}
          {result.confidence === "low" && (
            <div className="result-label-low">LOW DATA</div>
          )}
        </div>
      </div>
      <div className="result-stats">
        <div className="result-stat">
          <div
            className={`result-stat-value ${
              result.winRate !== null && result.winRate >= 50
                ? "stat-green"
                : "stat-red"
            }`}
          >
            {result.winRate !== null ? `${result.winRate}%` : "—"}
          </div>
          <div className="result-stat-label">WIN RATE</div>
        </div>
        <div className="result-stat">
          <div
            className={`result-stat-value ${
              result.goldDiff15 !== null && result.goldDiff15 >= 0
                ? "stat-blue"
                : "stat-red"
            }`}
          >
            {formatGd(result.goldDiff15)}
          </div>
          <div className="result-stat-label">GD@15</div>
        </div>
        <div className="result-stat">
          <div className="result-stat-value">
            {formatGames(result.gamesPlayed)}
          </div>
          <div className="result-stat-label">GAMES</div>
        </div>
        <div className="result-stat">
          <div className="result-stat-value stat-gold">
            {result.tier ?? "—"}
          </div>
          <div className="result-stat-label">TIER</div>
        </div>
        <div className="result-stat">
          <div className="result-stat-value">
            {result.pickRate !== null ? `${result.pickRate}%` : "—"}
          </div>
          <div className="result-stat-label">PICK RATE</div>
        </div>
        <div className="result-stat">
          <div className="result-stat-value">
            {result.banRate !== null ? `${result.banRate}%` : "—"}
          </div>
          <div className="result-stat-label">BAN RATE</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/ResultCard.tsx
git commit -m "feat: add ResultCard component with stats display"
```

---

## Task 13: Frontend — App Shell with URL Params and Wiring

**Files:**
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Implement full App component with URL param sync**

`client/src/App.tsx`:
```tsx
import { useState, useEffect, useCallback } from "react";
import type { Champion, Lane, MatchupResult } from "./types";
import { loadChampions } from "./champions";
import { fetchMatchup } from "./api";
import ChampionPoolInput from "./components/ChampionPoolInput";
import LaneSelector from "./components/LaneSelector";
import RankDropdown from "./components/RankDropdown";
import EnemyInput from "./components/EnemyInput";
import ResultCard from "./components/ResultCard";

function getUrlParams(): {
  pool: string[];
  lane: Lane;
  rank: string;
  enemy: string;
} {
  const params = new URLSearchParams(window.location.search);
  const pool = params.get("pool")?.split(",").filter(Boolean) ?? [];
  const lane = (params.get("lane") as Lane) ?? "top";
  const rank = params.get("rank") ?? "emerald_plus";
  const enemy = params.get("enemy") ?? "";
  return { pool, lane, rank, enemy };
}

function setUrlParams(pool: string[], lane: string, rank: string, enemy: string) {
  const params = new URLSearchParams();
  if (pool.length > 0) params.set("pool", pool.join(","));
  if (lane) params.set("lane", lane);
  if (rank) params.set("rank", rank);
  if (enemy) params.set("enemy", enemy);
  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, "", newUrl);
}

export default function App() {
  const [allChampions, setAllChampions] = useState<Champion[]>([]);
  const [pool, setPool] = useState<Champion[]>([]);
  const [lane, setLane] = useState<Lane>("top");
  const [rank, setRank] = useState("emerald_plus");
  const [results, setResults] = useState<MatchupResult[] | null>(null);
  const [enemyName, setEnemyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [championsLoaded, setChampionsLoaded] = useState(false);

  // Load champions from Data Dragon on mount
  useEffect(() => {
    loadChampions()
      .then((champs) => {
        setAllChampions(champs);

        // Restore state from URL params
        const params = getUrlParams();
        const restored = params.pool
          .map((name) => champs.find(
            (c) => c.id === name || c.name.toLowerCase() === name.toLowerCase()
          ))
          .filter((c): c is Champion => c !== undefined);
        setPool(restored);
        setLane(params.lane);
        setRank(params.rank);
        setEnemyName(params.enemy);
        setChampionsLoaded(true);
      })
      .catch((err) => {
        setError(`Failed to load champion data: ${err instanceof Error ? err.message : "Unknown error"}`);
      });
  }, []);

  // Sync state to URL params
  useEffect(() => {
    if (!championsLoaded) return;
    setUrlParams(
      pool.map((c) => c.id),
      lane,
      rank,
      enemyName
    );
  }, [pool, lane, rank, enemyName, championsLoaded]);

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
        rank
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
              {rank.replace("_", " ")})
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
```

- [ ] **Step 2: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat: add App shell with URL param sync and full component wiring"
```

---

## Task 14: Frontend — Styling

**Files:**
- Modify: `client/src/App.css`

- [ ] **Step 1: Write all styles**

`client/src/App.css`:
```css
/* === Reset & Base === */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #0f1923;
  color: #e2e8f0;
  min-height: 100vh;
}

/* === App Layout === */
.app {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

.app-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  color: #64748b;
  font-size: 16px;
}

.app-header {
  text-align: center;
  padding: 20px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 24px;
}

.app-header h1 {
  font-size: 22px;
  letter-spacing: 1px;
  color: #e2e8f0;
}

.app-subtitle {
  font-size: 13px;
  color: #64748b;
  margin-top: 4px;
}

.app-main {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* === Labels === */
.label {
  display: block;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #64748b;
  margin-bottom: 8px;
}

/* === Champion Pool Input === */
.pool-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.pool-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(96, 165, 250, 0.15);
  border: 1px solid rgba(96, 165, 250, 0.3);
  border-radius: 20px;
  padding: 6px 12px;
  color: #93c5fd;
  font-size: 14px;
}

.pool-tag-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
}

.pool-tag-remove {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0 2px;
}

.pool-tag-remove:hover {
  color: #f87171;
}

.pool-add-wrapper {
  position: relative;
}

.pool-add-input {
  background: transparent;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 6px 14px;
  color: #e2e8f0;
  font-size: 14px;
  outline: none;
  width: 160px;
}

.pool-add-input::placeholder {
  color: #64748b;
}

.pool-add-input:focus {
  border-color: rgba(96, 165, 250, 0.5);
}

.pool-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  min-width: 200px;
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  margin-top: 4px;
  z-index: 10;
  max-height: 300px;
  overflow-y: auto;
}

.pool-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: none;
  border: none;
  color: #e2e8f0;
  font-size: 14px;
  cursor: pointer;
  text-align: left;
}

.pool-dropdown-item:hover {
  background: rgba(96, 165, 250, 0.15);
}

/* === Lane Selector === */
.lane-rank-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.lane-selector {
  flex: 1;
  min-width: 200px;
}

.lane-buttons {
  display: flex;
  gap: 4px;
}

.lane-btn {
  flex: 1;
  text-align: center;
  padding: 10px 0;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.lane-btn:hover {
  background: rgba(255, 255, 255, 0.06);
}

.lane-btn-active {
  background: rgba(251, 191, 36, 0.15);
  border-color: rgba(251, 191, 36, 0.4);
  color: #fbbf24;
}

/* === Rank Dropdown === */
.rank-dropdown {
  min-width: 180px;
}

.rank-select {
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 10px 14px;
  color: #e2e8f0;
  font-size: 14px;
  cursor: pointer;
  outline: none;
  appearance: auto;
}

.rank-select option {
  background: #1e293b;
  color: #e2e8f0;
}

/* === Enemy Input === */
.enemy-row {
  display: flex;
  gap: 12px;
}

.enemy-search-wrapper {
  flex: 1;
  position: relative;
}

.enemy-search {
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 12px 14px;
  color: #e2e8f0;
  font-size: 14px;
  outline: none;
}

.enemy-search::placeholder {
  color: #64748b;
}

.enemy-search:focus {
  border-color: rgba(96, 165, 250, 0.5);
}

.find-btn {
  background: #3b82f6;
  border: none;
  border-radius: 6px;
  padding: 12px 24px;
  color: white;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}

.find-btn:hover:not(:disabled) {
  background: #2563eb;
}

.find-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* === Error === */
.error-msg {
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.3);
  border-radius: 6px;
  padding: 12px 16px;
  color: #fca5a5;
  font-size: 14px;
}

/* === Results === */
.results {
  margin-top: 4px;
}

.results-header {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #64748b;
  margin-bottom: 16px;
}

/* === Result Card === */
.result-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 10px;
  flex-wrap: wrap;
  gap: 12px;
}

.result-card-best {
  background: rgba(52, 211, 153, 0.08);
  border-color: rgba(52, 211, 153, 0.25);
}

.result-card-worst {
  background: rgba(248, 113, 113, 0.05);
  border-color: rgba(248, 113, 113, 0.15);
}

.result-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.result-rank {
  color: #94a3b8;
  font-weight: bold;
  font-size: 18px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-rank-best {
  background: rgba(52, 211, 153, 0.2);
  color: #34d399;
}

.result-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
}

.result-name {
  color: #e2e8f0;
  font-weight: 600;
  font-size: 16px;
}

.result-label-best {
  color: #34d399;
  font-size: 13px;
}

.result-label-worst {
  color: #f87171;
  font-size: 13px;
}

.result-label-low {
  color: #fbbf24;
  font-size: 11px;
  opacity: 0.8;
}

.result-stats {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.result-stat {
  text-align: center;
}

.result-stat-value {
  font-size: 20px;
  font-weight: bold;
  color: #e2e8f0;
}

.result-stat-label {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}

.stat-green {
  color: #34d399;
}

.stat-red {
  color: #f87171;
}

.stat-blue {
  color: #60a5fa;
}

.stat-gold {
  color: #fbbf24;
}

/* === Responsive === */
@media (max-width: 600px) {
  .result-stats {
    gap: 16px;
  }

  .result-stat-value {
    font-size: 16px;
  }

  .lane-rank-row {
    flex-direction: column;
  }

  .enemy-row {
    flex-direction: column;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/App.css
git commit -m "feat: add complete dark theme styling for all components"
```

---

## Task 15: End-to-End Smoke Test

**Files:** None — manual testing only

- [ ] **Step 1: Start both servers**

Terminal 1: `cd server && npm run dev` — Express on port 3001
Terminal 2: `cd client && npm run dev` — Vite dev server (usually port 5173)

- [ ] **Step 2: Test the full flow in browser**

1. Open the Vite dev server URL
2. Verify the header "MATCHUP PICKER" renders
3. Search and add 2-3 champions to the pool (e.g., Darius, Aatrox, Fiora)
4. Select "TOP" lane and "Emerald+" rank
5. Search for an enemy champion (e.g., Teemo)
6. Click "Find Best Pick"
7. Verify results appear with winrate, GD@15, games, tier, pick rate, ban rate
8. Verify the URL updates with pool, lane, rank, enemy params
9. Copy the URL, open in a new tab — verify state is restored

- [ ] **Step 3: Test edge cases**

1. Try submitting with empty pool — should show error
2. Try adding 6th champion — should be blocked
3. Remove a champion from pool — verify pill disappears
4. Change lane and re-query — verify different results

- [ ] **Step 4: Fix any issues found during testing**

Address scraper selector issues, styling bugs, or data parsing problems found during smoke testing. The u.gg HTML structure may differ slightly from what was researched — iterate on selectors as needed.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during end-to-end smoke testing"
```
