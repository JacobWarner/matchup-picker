import { createContext } from "./browser.js";
import { withThrottle } from "./throttle.js";
import { normalizeChampionName } from "../champions.js";

export interface CounterPageData {
  [normalizedName: string]: {
    winRate: number | null;
    gamesPlayed: number | null;
    goldDiff15: number | null;
  };
}

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

      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });

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

      const title = await page.title();
      if (title.includes("Just a moment") || title.includes("Attention Required")) {
        throw new Error("u.gg bot detection triggered — CAPTCHA/challenge page returned");
      }

      try {
        await page.waitForSelector('a[href*="/lol/champions/"][href*="/build"]', { timeout: 30000 });
      } catch {
        throw new Error(
          `Counter page for ${enemyUggName} did not render expected content within 10s. ` +
          "u.gg's page structure may have changed."
        );
      }

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

      if (Object.keys(data).length === 0) {
        throw new Error(
          "Counter page returned zero champion rows. u.gg's page structure may have changed."
        );
      }

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
      await context.close();
    }
  });
}

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
