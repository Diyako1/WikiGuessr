# WikiGuessr

A Wikipedia navigation game where you try to get from one article to another using only links. Think of it like Six Degrees of Kevin Bacon, but for Wikipedia.

## What it does

You start on a random Wikipedia article and need to reach a target article by clicking links. The catch is you can only use links within the articles themselves - no searching, no going back, just clicking through Wikipedia until you reach your destination.

The game tracks how many clicks it takes you, how long you spent, and tells you if you're getting closer or farther from the target. There's also a difficulty system based on how many "hops" the optimal path takes.

## Screenshots

<img width="2094" height="1194" alt="Image" src="https://github.com/user-attachments/assets/100ae49f-0f71-44e4-a860-f74e2c614b3d" />
*Setting up a new game - pick your start and target articles or generate random ones*

<img width="1704" height="1478" alt="Image" src="https://github.com/user-attachments/assets/651fba85-fdb8-41b6-8e36-7413e046ca7e" />*Playing the game - navigating from Drake to Genghis Khan - progress bar reflects how close you are*

<img width="1344" height="1360" alt="Image" src="https://github.com/user-attachments/assets/b4240ae4-f66f-455d-96d4-1e4ba7d26bf1" />
*screen once you make it to target*

<img width="1752" height="1120" alt="Image" src="https://github.com/user-attachments/assets/c079460b-cf87-4c46-8da2-fda383884507" />
*If you choose to look at optimal path*

## Tech Stack

Built with Next.js 16, TypeScript, and Prisma. Uses the official Wikipedia APIs to fetch article content and links. Redis for caching (optional), PostgreSQL for storing game results.

The path-finding uses a bidirectional BFS algorithm that searches from both start and target simultaneously until they meet. I tried A* first but BFS is more reliable for this since Wikipedia links don't have edge weights.

## Setup

Clone the repo and install dependencies:

```bash
npm install
```

You'll need:
- Node.js 18+
- PostgreSQL (optional - app works without it using in-memory storage)
- Redis (optional - falls back to in-memory cache)

Copy `.env.example` to `.env` and fill in your database URL if you want persistent storage:

```bash
cp env.example .env
```

Run migrations:

```bash
npx prisma migrate dev
```

Start the dev server:

```bash
npm run dev
```

## How it works

The app is split into a few main parts:

**Frontend** (`src/app/`):
- Home page where you pick articles
- Game page that shows Wikipedia articles and tracks your path
- Results page with your stats

**API Routes** (`src/app/api/`):
- `/api/wiki/*` - Proxies Wikipedia API calls (search, get page, get links)
- `/api/game/*` - Handles game state (start, move, complete)
- `/api/solve/*` - Path-finding endpoints
- `/api/generate` - Generates random article pairs

**Core Logic** (`src/lib/`):
- `wiki/` - Wikipedia API client with caching
- `solver/` - Bidirectional BFS path-finding algorithm
- `game/` - Game session management and scoring
- `redis.ts` - Caching layer (in-memory fallback if Redis isn't available)
- `db.ts` - Prisma database client

The solver uses a bounded bidirectional BFS with configurable depth limits and time budgets. For checking if two articles are connected, it searches from both directions simultaneously until they meet or hit the limits.

Wikipedia APIs are rate-limited, so everything is heavily cached. Links and summaries cache for 24 hours, search results for 10 minutes.

## Notes

- The game filters out a bunch of citation/reference pages like "ISSN (identifier)" and "ISBN" because they make paths too easy and aren't fun to click through
- The difficulty system is based on Wikipedia's six degrees of separation - most articles are only 2-3 clicks apart, so the "difficult" paths are still pretty short
- The progress bar uses the optimal path to tell you if you're getting closer or farther
- All Wikipedia content is licensed under CC BY-SA 4.0

## License

MIT
