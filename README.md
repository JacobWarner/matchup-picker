# Matchup Picker

A web tool for League of Legends players who want to know which champion from their personal pool gives them the best chance of winning a specific matchup.

Enter your champion pool (2-5 champions), pick your lane and rank, then search for the enemy champion you're facing. The tool scrapes live data from [u.gg](https://u.gg) and ranks your pool from best to worst matchup, showing win rate, gold difference at 15 minutes, games played, tier, pick rate, and ban rate.

## How It Works

1. **Add your champion pool** — the 2-5 champions you play in a given role
2. **Select your lane and rank** — data is filtered to match your elo and position
3. **Enter the enemy champion** — who you're up against in champ select
4. **Get ranked results** — your pool champions sorted by win rate against the enemy, with full stats

All settings are saved in the URL, so you can bookmark your pool or share it with friends.

## Screenshots

*Coming soon*

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React, TypeScript, Vite | UI with champion autocomplete, lane/rank selectors, result cards |
| Backend | Node.js, Express, TypeScript | API endpoint, request validation, result assembly |
| Scraping | Playwright (headless Chromium) | Fetches live matchup data from u.gg counter and build pages |
| Static Data | [Riot Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon) | Champion names, icons, and IDs (free, no API key needed) |
| Deployment | Docker, Render | Single-service deployment with `render.yaml` blueprint |

## Architecture

```
Browser                    Express Server                  External
┌──────────────┐    POST   ┌──────────────────┐           ┌─────────┐
│ React App    │ ─────────>│ /api/matchup     │           │ u.gg    │
│              │           │                  │──Playwright──>│ counter │
│ Pool input   │           │ Validates input  │           │ pages   │
│ Lane/Rank    │           │ Resolves names   │           │         │
│ Enemy search │           │ Scrapes in       │──Playwright──>│ build   │
│ Result cards │<──────────│ parallel         │           │ pages   │
└──────────────┘   JSON    └──────────────────┘           └─────────┘
                                    │                     ┌─────────┐
                                    │                     │ Riot    │
                                    └─────────────────────>│ Data    │
                                      champion names/icons │ Dragon  │
                                                          └─────────┘
```

For each query, the server scrapes **each pool champion's counter page** on u.gg to find the enemy's stats, then inverts win rate and gold diff (since counter pages show the opponent's perspective). Build pages are scraped in parallel to get tier, pick rate, and ban rate. A concurrency throttle prevents overwhelming u.gg with simultaneous requests.

## Running Locally

**Prerequisites:** Node.js 20+, npm

```bash
# Install dependencies
npm install

# Install Playwright's Chromium browser
cd server && npx playwright install chromium && cd ..

# Start the backend (port 3001)
cd server && npm run dev

# In another terminal, start the frontend (port 5173)
cd client && npm run dev
```

Open http://localhost:5173 in your browser.

## Running Tests

```bash
cd server

# Unit tests (fast, no network)
npm test

# Integration tests (hits u.gg live, ~15 seconds)
npm run test:integration
```

## Deployment

The app is configured for one-click deployment on [Render](https://render.com):

1. Push to GitHub
2. Connect the repo on Render
3. Render auto-detects `render.yaml` and builds the Docker image
4. First build takes ~5 minutes (Chromium is large)

The Dockerfile runs a multi-stage build: compiles the React frontend, compiles the TypeScript server, then packages everything into a Playwright base image with Chromium pre-installed. In production, Express serves both the API and the built frontend as a single service.

**Free tier note:** Render's free tier has 512MB RAM. Playwright with Chromium fits within this for low-traffic use, but the service sleeps after 15 minutes of inactivity and takes ~30-60 seconds to wake up on the next request.

## Project Structure

```
matchup-picker/
├── client/                     # React frontend
│   └── src/
│       ├── App.tsx             # Root component, URL param sync
│       ├── api.ts              # POST /api/matchup client
│       ├── champions.ts        # Data Dragon loader + search
│       ├── types.ts            # Shared types and constants
│       └── components/
│           ├── ChampionPoolInput.tsx
│           ├── LaneSelector.tsx
│           ├── RankDropdown.tsx
│           ├── EnemyInput.tsx
│           └── ResultCard.tsx
├── server/                     # Express backend
│   └── src/
│       ├── index.ts            # Server entry, static file serving
│       ├── champions.ts        # DDragon name mapping + u.gg conversion
│       ├── types.ts            # API types, RANK_MAP, LANE_MAP
│       ├── routes/
│       │   └── matchup.ts      # POST /api/matchup handler
│       └── scraper/
│           ├── browser.ts      # Playwright singleton with anti-detection
│           ├── throttle.ts     # Concurrency limiter
│           ├── counterPage.ts  # Scrapes matchup WR, GD@15, games
│           ├── buildPage.ts    # Scrapes tier, pick rate, ban rate
│           └── parseUtils.ts   # Text extraction helpers
├── Dockerfile                  # Multi-stage production build
└── render.yaml                 # Render deployment blueprint
```

## Limitations

- **Scraping fragility** — u.gg uses Tailwind CSS with dynamic class names. If u.gg redesigns their pages, the scrapers will need updating. Errors are surfaced clearly when this happens.
- **No caching** — every query scrapes u.gg live for the freshest data. This means ~5-10 seconds per query, but you always get current patch stats.
- **Bot detection** — the scraper uses a realistic user-agent and isolated browser contexts, but heavy usage from a single IP could trigger u.gg's anti-bot measures.
- **Memory** — Playwright + Chromium needs ~300-400MB RAM. Works on Render's free tier for light use, but may need a paid tier ($7/mo) under sustained load.

## License

MIT
