# Champion Matchup Picker — Design Spec

## Overview

A web application that helps League of Legends players pick the best champion from their personal pool for a given matchup. The user enters their champion pool (2-5 champions), selects a lane and rank tier, then inputs an enemy champion. The tool scrapes u.gg for matchup data and ranks the pool champions from best to worst winrate against that enemy.

## Architecture

Three-layer system:

- **Frontend (React + TypeScript + Vite):** Handles all user input and displays results. Champion pool state is encoded in URL query parameters for easy sharing and bookmarking. Champion icons and metadata come from Riot's Data Dragon CDN (free, no auth).
- **Backend (Node.js + Express + TypeScript + Playwright):** Single API endpoint that receives the pool, enemy, lane, and rank. Scrapes u.gg counter pages in parallel using headless Chromium, parses the results, ranks them by winrate, and returns structured JSON.
- **External (u.gg + Riot Data Dragon):** u.gg provides matchup winrate data via its counter pages. Riot Data Dragon provides champion names, IDs, and icon images.

No database is needed. The system is fully stateless.

## Data Source: u.gg Scraping

u.gg does not have a public API. The backend uses Playwright to scrape their counter pages.

### URL Pattern

For each pool champion vs the enemy:
```
https://u.gg/lol/champions/{champion}/counter?enemy={enemy}&role={lane}&rank={rank}
```

Example for a 3-champion pool (Darius, Aatrox, Fiora) vs Teemo, Top lane, Emerald+:
```
https://u.gg/lol/champions/darius/counter?enemy=teemo&role=top&rank=emerald_plus
https://u.gg/lol/champions/aatrox/counter?enemy=teemo&role=top&rank=emerald_plus
https://u.gg/lol/champions/fiora/counter?enemy=teemo&role=top&rank=emerald_plus
```

### Scraping Strategy

- Playwright launches a headless Chromium browser.
- All pool champion pages are opened in parallel tabs (one per pool champion).
- The scraper waits for matchup data to render, then extracts the relevant statistics.
- The browser instance stays alive between requests to avoid cold-start overhead.
- Scraping is on-demand (no caching). Each query hits u.gg live for fresh data. Expected latency: ~3-5 seconds per query regardless of pool size (parallel).

### Extracted Data Per Pool Champion

| Field | Description |
|-------|-------------|
| Win Rate | Percentage winrate in the specific matchup |
| Gold Diff @15 | Average gold differential at 15 minutes |
| Games Played | Sample size for the matchup |
| Tier | Overall champion tier (S, A, B, C, D) |
| Pick Rate | Overall pick rate percentage |
| Ban Rate | Overall ban rate percentage |

## UI Layout

### Setup Area

**Champion Pool Input:**
- Pill-style tags showing champion icon + name, with a remove button on each.
- "Add Champion" button opens a search/autocomplete dropdown powered by Data Dragon's champion list.
- Minimum 1 champion, maximum 5.

**Lane Selector:**
- Toggle button group: Top, Jungle, Mid, Bot, Support.
- One lane selected at a time.

**Rank Selector:**
- Dropdown with all u.gg rank presets:
  - Individual ranks: Iron, Bronze, Silver, Gold, Platinum, Emerald, Diamond, Master, Grandmaster, Challenger
  - Aggregated ranks: Silver+, Gold+, Platinum+, Emerald+, Diamond+, Master+
  - Overall (all ranks)

**Enemy Champion Input:**
- Search input with autocomplete.
- "Find Best Pick" button triggers the query.

### Results Area

- One card per pool champion, ranked best to worst by matchup winrate.
- Best pick card highlighted green with "BEST PICK" label.
- Worst pick card highlighted red with "WORST PICK" label.
- Each card displays: Win Rate, Gold Diff @15, Games Played, Tier, Pick Rate, Ban Rate.
- Champion icons from Riot Data Dragon.

## URL Parameter Schema

All state is encoded in URL query parameters:

```
?pool=Darius,Aatrox,Fiora&lane=top&rank=emerald_plus&enemy=Teemo
```

| Param | Format | Example |
|-------|--------|---------|
| pool | Comma-separated champion names | Darius,Aatrox,Fiora |
| lane | Lowercase lane name | top, jungle, mid, bot, support |
| rank | u.gg rank key | emerald_plus, platinum_plus, overall |
| enemy | Champion name | Teemo |

The pool, lane, and rank persist across queries. The enemy param updates when a new query is made.

Champion names in URL params use Data Dragon's PascalCase format (e.g., `DrMundo`, `MissFortune`, `Aatrox`). The backend converts these to u.gg's lowercase format (e.g., `drmundo`, `missfortune`, `aatrox`) when constructing scrape URLs.

## API Contract

### POST /api/matchup

**Request:**
```json
{
  "pool": ["Darius", "Aatrox", "Fiora"],
  "enemy": "Teemo",
  "lane": "top",
  "rank": "emerald_plus"
}
```

**Response:**
```json
{
  "enemy": "Teemo",
  "lane": "top",
  "rank": "emerald_plus",
  "results": [
    {
      "champion": "Darius",
      "winRate": 54.2,
      "goldDiff15": 320,
      "gamesPlayed": 12400,
      "tier": "S",
      "pickRate": 8.2,
      "banRate": 12.1,
      "confidence": "high"
    },
    {
      "champion": "Fiora",
      "winRate": 51.8,
      "goldDiff15": 180,
      "gamesPlayed": 8700,
      "tier": "A",
      "pickRate": 6.1,
      "banRate": 5.3,
      "confidence": "high"
    },
    {
      "champion": "Aatrox",
      "winRate": 47.3,
      "goldDiff15": -210,
      "gamesPlayed": 15200,
      "tier": "A",
      "pickRate": 11.5,
      "banRate": 9.8,
      "confidence": "high"
    }
  ]
}
```

Results are sorted by winRate descending. The `confidence` field is "high" when gamesPlayed >= 500, "low" otherwise.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, TypeScript, Vite |
| Backend | Node.js, Express, TypeScript |
| Scraping | Playwright (headless Chromium) |
| Static Data | Riot Data Dragon CDN |
| Monorepo | npm workspaces |

## Project Structure

```
TylerPrototype/
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/      # PoolInput, LaneSelector, RankDropdown, EnemyInput, ResultCard
│   │   ├── hooks/           # useChampionSearch, useMatchupQuery
│   │   ├── utils/           # URL param encoding/decoding, Data Dragon helpers
│   │   └── App.tsx
│   └── package.json
├── server/                  # Express backend
│   ├── src/
│   │   ├── scraper/         # Playwright scraping + HTML parsing logic
│   │   ├── routes/          # /api/matchup endpoint
│   │   └── index.ts
│   └── package.json
└── package.json             # Root workspace config
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Champion name not found | Validate against Data Dragon list. Autocomplete prevents typos. |
| Matchup data unavailable | Return "no data" state for that champion. Don't fail the whole request. |
| Low sample size (<500 games) | Flag result as `confidence: "low"` in the response. UI shows a warning indicator. |
| u.gg down or layout changed | Return error message to user: "Unable to fetch data. Try again later." |
| Empty champion pool | Require at least 1 champion. UI enforces this. |
| Pool exceeds 5 champions | Cap at 5. UI prevents adding more. |
| Invalid URL params | Silently drop invalid champion names. Show valid pool members only. |
| Scrape timeout | 15-second timeout per page. Return error state for timed-out champions. |
