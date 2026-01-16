# WikiGuessr 🎮

A Wikipedia navigation game inspired by the "Wiki Game" where players navigate from a START Wikipedia article to a TARGET article by clicking links within the articles. Built as a full-stack Next.js application with Wikipedia-style UI.

## 🎯 What This Is

WikiGuessr is a browser-based game where you:
1. Start on a random Wikipedia article
2. Try to reach a target Wikipedia article
3. Navigate ONLY by clicking blue links within articles
4. Race against time and try to minimize clicks

Think of it like "Six Degrees of Kevin Bacon" but for Wikipedia!

---

## 🏗️ How It's Built

### Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 14 (App Router) | React framework with server components |
| Styling | TailwindCSS + Inline styles | Wikipedia-authentic look |
| Language | TypeScript | Type safety throughout |
| Database | PostgreSQL + Prisma ORM | Store completed game runs |
| Caching | Redis (optional) | Cache Wikipedia data & game sessions |
| APIs | Wikimedia REST & Action APIs | Fetch Wikipedia content |

### Project Structure

```
wikiguessr/
├── src/
│   ├── app/                      # Next.js App Router pages
│   │   ├── page.tsx              # Home/Setup screen
│   │   ├── play/[gameId]/        # Main gameplay screen
│   │   ├── results/[gameId]/     # Results after winning
│   │   └── api/                  # Backend API routes
│   │       ├── wiki/             # Wikipedia API proxies
│   │       │   ├── search/       # Autocomplete search
│   │       │   ├── resolve/      # Title resolution
│   │       │   └── page/         # Get article content + links
│   │       ├── solve/            # Path-finding algorithms
│   │       │   ├── feasible/     # Check if path exists
│   │       │   └── path/         # Find optimal path (hint)
│   │       ├── generate/         # Random pair generator
│   │       └── game/             # Game session management
│   │           ├── start/        # Create new game
│   │           ├── move/         # Handle link clicks
│   │           ├── [gameId]/     # Get game state
│   │           └── complete/     # Finish & save game
│   ├── components/               # React UI components
│   │   ├── WikiArticle.tsx       # Renders Wikipedia HTML
│   │   ├── AutocompleteInput.tsx # Search with suggestions
│   │   ├── ProgressBar.tsx       # Hot/cold distance indicator
│   │   ├── LinkList.tsx          # Searchable link grid
│   │   ├── OptimalPath.tsx       # Hint feature
│   │   └── ...
│   ├── lib/                      # Core business logic
│   │   ├── wiki/                 # Wikipedia API client
│   │   │   ├── client.ts         # API calls to Wikimedia
│   │   │   └── index.ts          # Exports
│   │   ├── solver/               # Path-finding algorithm
│   │   │   └── index.ts          # Bidirectional BFS
│   │   ├── game/                 # Game session logic
│   │   │   └── index.ts          # Create/update/score games
│   │   ├── redis.ts              # Caching layer
│   │   └── db.ts                 # Prisma database client
│   └── data/
│       └── titles.json           # Curated article pool for generator
└── prisma/
    └── schema.prisma             # Database schema
```

---

## 🧠 Core Logic Explained

### 1. Wikipedia API Integration (`src/lib/wiki/`)

We use **official Wikimedia APIs only** (no HTML scraping):

```typescript
// Search API - for autocomplete
GET https://en.wikipedia.org/w/rest.php/v1/search/title?q={query}&limit=10

// Page Summary API - for article info
GET https://en.wikipedia.org/api/rest_v1/page/summary/{title}

// Action API - for outgoing links
GET https://en.wikipedia.org/w/api.php?action=query&titles={title}&prop=links&pllimit=max

// Parse API - for full HTML content
GET https://en.wikipedia.org/w/api.php?action=parse&page={title}&prop=text
```

**Caching Strategy:**
- Links and summaries: 24 hours (Wikipedia doesn't change that often)
- Search results: 10 minutes (fresher autocomplete)
- Game sessions: 24 hours (survive server restarts in dev)

### 2. Path-Finding Solver (`src/lib/solver/`)

The heart of the game is a **Bounded Bidirectional BFS** algorithm:

```
                    START                              TARGET
                      │                                  │
           ┌─────────┼─────────┐            ┌─────────┼─────────┐
           ▼         ▼         ▼            ▼         ▼         ▼
        Link A    Link B    Link C       Link X    Link Y    Link Z
           │         │         │            │         │         │
           ▼         ▼         ▼            ▼         ▼         ▼
          ...       ...       ...          ...       ...       ...
                         
                    ────── MEET IN MIDDLE ──────
```

**Why Bidirectional?**
- Regular BFS from start might explore millions of nodes
- Searching from BOTH ends meets in the middle much faster
- Reduces search space exponentially

**Constraints (to prevent timeouts):**
```typescript
const DEFAULT_MAX_DEPTH = 7;        // Max 7 hops
const MAX_VISITED_NODES = 100000;   // Stop after 100k nodes
const MAX_TIME_MS = 10000;          // 10 second timeout
```

**Return Values:**
- `POSSIBLE` + distance: Found a path!
- `NOT_POSSIBLE`: No path within 7 hops
- `UNKNOWN`: Hit limits before finding answer

### 3. Game Session Management (`src/lib/game/`)

Each game session tracks:
```typescript
interface GameSession {
  id: string;              // UUID
  startTitle: string;      // Where you began
  targetTitle: string;     // Where you're going
  currentTitle: string;    // Where you are now
  dStart: number;          // Initial distance (hops)
  dPrev: number | null;    // Distance after last move
  clicks: number;          // Move counter
  pathTitles: string[];    // Breadcrumb trail
  startedAt: number;       // Timestamp for timer
  status: 'active' | 'won' | 'abandoned';
}
```

**On Each Move:**
1. Validate the clicked link exists on current page
2. Update current position
3. Recalculate distance to target (for hot/cold)
4. Check win condition
5. Return new page content + links

### 4. WikiArticle Component (`src/components/WikiArticle.tsx`)

The trickiest part! Renders actual Wikipedia HTML with clickable game links:

```typescript
// Process Wikipedia HTML
const processedHtml = useMemo(() => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  
  // Find all <a> tags
  tempDiv.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href');
    
    // Extract title from href (e.g., "./France" → "France")
    let linkTitle = extractTitle(href);
    
    if (gameLinks.includes(linkTitle)) {
      // Make it clickable for the game
      a.setAttribute('data-wiki-link', linkTitle);
      a.style.color = '#0645ad';  // Wikipedia blue
      a.style.cursor = 'pointer';
    } else {
      // Disable non-game links
      a.style.color = '#72777d';
      a.style.cursor = 'default';
    }
  });
  
  return tempDiv.innerHTML;
}, [htmlContent, gameLinks]);
```

**Click Handling:**
```typescript
// Event delegation on the container
useEffect(() => {
  const handleClick = (event) => {
    const link = event.target.closest('a[data-wiki-link]');
    if (link) {
      event.preventDefault();
      onLinkClick(link.getAttribute('data-wiki-link'));
    }
  };
  
  container.addEventListener('click', handleClick, true);
  return () => container.removeEventListener('click', handleClick, true);
}, [onLinkClick]);
```

### 5. Random Pair Generator (`src/app/api/generate/`)

Generates feasible start/target pairs:

1. Pick random article from curated pool (`titles.json`)
2. Pick another random article
3. Run solver to check if path exists
4. If feasible AND matches difficulty, return it
5. Otherwise, try again (max 10 attempts)

**Difficulty Ranges:**
| Difficulty | Hops |
|------------|------|
| Easy | 2-3 |
| Medium | 4-5 |
| Hard | 6-7 |
| Insane | 8+ |

---

## ⚠️ Known Limitations & Struggles

### 1. **Link Matching** ✅ FIXED

Previously, Wikipedia HTML used relative URLs like `./France` while our links array had `France`. This caused many links to not be clickable.

**Fix implemented:**
- Created `canonicalTitle()` normalization function in `/lib/wiki/normalize.ts`
- Both fetched links AND extracted hrefs now use the same normalization
- Handles URL encoding, prefixes (`./`, `/wiki/`), fragments (`#section`), underscores vs spaces
- Uses `Set<string>` for O(1) lookup instead of O(n) array search

### 2. **Missing Links (Pagination)** ✅ FIXED

The Wikipedia Action API returns max 500 links per request. Without pagination, high-link pages like "United States" were missing most links.

**Fix implemented:**
- Full pagination loop using `plcontinue` token
- Now fetches ALL outgoing links (can be 1000+ for major articles)
- Cached for 24 hours to avoid repeated API calls

### 3. **Performance & Race Conditions** ✅ FIXED

Fast clicking caused stuck loading states and stale data.

**Fix implemented:**
- `AbortController` cancels in-flight requests when user clicks again
- `currentTitleRef` guards against race conditions
- HTML content cached server-side
- Quick distance check uses smaller budget (500ms, 2000 nodes) for responsive UI

### 4. **Solver Performance** ✅ IMPROVED

Full solver was too slow for per-move distance updates.

**Fix implemented:**
- Two-tier solver: quick check (500ms) for moves, full solver (5s) for feasibility
- Distance caching in Redis: `dist:<from>:<to>` with 1h TTL
- Page data fetched in parallel with distance calculation

### 5. **Session Persistence in Development**

Without Redis, game sessions are stored in memory:
- Server restarts (from code changes) clear all sessions
- You'll see "Session expired" errors during development

**Workaround:** We use `globalThis` to persist the cache across hot reloads, but full server restarts still clear it.

### 6. **Wikipedia HTML is Messy**

Wikipedia's HTML includes:
- Edit buttons (hidden with CSS)
- Navboxes and infoboxes (sometimes break layout)
- Complex tables
- Math formulas (may not render)
- Images with complex positioning

**Current approach:** We apply Wikipedia-like CSS and hide problematic elements, but some articles still look weird.

### 7. **Rate Limiting from Wikipedia**

Wikimedia APIs have rate limits. If you play too fast or the solver runs too many queries, you might get throttled.

**Mitigation:** 
- Aggressive caching (24h for links, HTML, summaries)
- Rate limiting on our API routes
- Exponential backoff on failures

### 8. **No Mobile Optimization**

The UI is designed for desktop. Mobile users will have a poor experience with:
- Small touch targets on links
- Long article scrolling
- Header taking too much space

### 9. **Database Optional but Incomplete**

PostgreSQL stores completed games, but:
- No leaderboard UI
- No user accounts
- No game history page
- Fails silently if DB is unavailable

---

## 🚀 Running the Project

### Minimal Setup (No Redis/PostgreSQL)

```bash
# Install dependencies
npm install

# Start dev server (uses in-memory cache)
npm run dev
```

The app will work without Redis/PostgreSQL, but:
- Sessions may be lost on server restart
- Game results won't be saved

### Full Setup

```bash
# 1. Set up environment
cp env.example .env
# Edit .env with your DATABASE_URL and REDIS_URL

# 2. Generate Prisma client
npx prisma generate

# 3. Run database migrations
npx prisma migrate dev

# 4. Start the server
npm run dev
```

---

## 📊 Scoring Formula

```
Base Score = max(0, 10000 - clicks × 650 - timeSeconds × 8)

Multipliers:
- Easy (2-3 hops):   1.0×
- Medium (4-5 hops): 1.2×
- Hard (6-7 hops):   1.5×
- Insane (8+ hops):  1.8×

Final Score = Base Score × Multiplier
```

**Example:** 
- 5 clicks, 45 seconds, Medium difficulty
- Base: 10000 - (5 × 650) - (45 × 8) = 10000 - 3250 - 360 = 6390
- Final: 6390 × 1.2 = 7668 points

---

## 🔧 Recent Fixes (Performance & Reliability)

### Changes Made:

1. **`/lib/wiki/normalize.ts`** (NEW)
   - `canonicalTitle()` - Consistent title normalization
   - `isInternalArticleLink()` - Filter out external/special links
   - `createLinkSet()` - O(1) lookup Set creation

2. **`/lib/wiki/client.ts`** (UPDATED)
   - Full pagination for `getOutgoingLinks()` using `plcontinue`
   - HTML caching via `fetchPageHtml()`
   - Debug logging for cache hits/misses

3. **`/lib/solver/index.ts`** (UPDATED)
   - `quickDistanceCheck()` - Fast 500ms budget for per-move updates
   - Distance caching in Redis
   - Configurable limits for different use cases

4. **`/components/WikiArticle.tsx`** (UPDATED)
   - Uses `Set<string>` for O(1) link lookup
   - Consistent `canonicalTitle()` for href extraction
   - Debug logging for matched/skipped links

5. **`/app/play/[gameId]/page.tsx`** (UPDATED)
   - `AbortController` for canceling stale requests
   - `currentTitleRef` to prevent race conditions
   - Parallel data fetching

6. **`/app/api/game/move/route.ts`** (UPDATED)
   - Returns `htmlContent` in response
   - Uses `quickDistanceCheck()` for fast response
   - Parallel fetching of page data

### Debug Logging:

Check server console for:
```
[CACHE HIT] links:United States (1523 links)
[LINKS] Iteration 1: +500 links (total: 500)
[LINKS] Iteration 2: +500 links (total: 1000)
[SOLVER CACHE HIT] France -> Germany: 2
[WikiArticle] Processed 847 anchors: 423 clickable, 424 disabled
```

---

## 🔮 Future Improvements

If I had more time, I would add:

1. **Redirect resolution** - Use Wikipedia's API to resolve redirects
2. **Multiplayer mode** - Race against friends in real-time
3. **Daily challenges** - Same puzzle for everyone each day
4. **Leaderboards** - Global and friend rankings
5. **Mobile-responsive design** - Proper touch UI
6. **Offline support** - Cache articles for offline play
7. **Achievement system** - Badges for milestones
8. **Article previews** - Hover to see link summaries

---

## 📜 License

MIT License - feel free to use, modify, and distribute.

## 🙏 Acknowledgments

- **Wikipedia/Wikimedia Foundation** - For their incredible free APIs
- **The Wiki Game** - Original inspiration for this concept
- **GeoGuessr** - Inspiration for the hot/cold progress mechanic
