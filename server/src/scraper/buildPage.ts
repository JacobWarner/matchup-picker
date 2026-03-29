import { createContext } from "./browser.js";
import { withThrottle } from "./throttle.js";

export interface BuildPageData {
  tier: string | null;
  pickRate: number | null;
  banRate: number | null;
}

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
