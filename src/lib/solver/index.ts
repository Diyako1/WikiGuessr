/**
 * Bounded Bidirectional BFS Solver for Wikipedia navigation
 * Finds shortest path between two Wikipedia articles
 */

import { getOutgoingLinks, normalizeTitle, isBlockedTitle } from '@/lib/wiki';
import { getCached, setCache, CACHE_KEYS } from '@/lib/redis';

export type SolverStatus = 'POSSIBLE' | 'NOT_POSSIBLE' | 'UNKNOWN';

export interface SolverResult {
  status: SolverStatus;
  distance?: number;
  d_start?: number; // Alias for compatibility
  path?: string[];
  reason?: string;
}

export interface DistanceResult {
  distance: number | null;
  status: 'KNOWN' | 'UNKNOWN';
}

// Solver configuration - default for feasibility checks
const DEFAULT_MAX_DEPTH = 7;
const MAX_VISITED_NODES = 50000;
const MAX_TIME_MS = 5000;

// Quick solver config for per-move distance checks (faster, smaller budget)
const QUICK_MAX_DEPTH = 5;
const QUICK_MAX_NODES = 5000;
const QUICK_MAX_TIME_MS = 1500;

// Cache TTL
const PATH_CACHE_TTL = 3600; // 1 hour

// Cache version - increment this to invalidate old caches
// v2: Added blocklist filtering for citation pages
const CACHE_VERSION = 'v2';

// Cache structure that stores both distance AND path
interface CachedPath {
  distance: number | null;
  path?: string[];
  status: SolverStatus;
}

/**
 * Check if a cached path contains any blocked titles
 */
function pathContainsBlockedTitle(path: string[] | undefined): boolean {
  if (!path) return false;
  return path.some(title => isBlockedTitle(title));
}

/**
 * Get cached path result between two articles
 */
async function getCachedPath(from: string, to: string): Promise<CachedPath | null> {
  const key = `${CACHE_KEYS.RESOLVE}path:${CACHE_VERSION}:${from}:${to}`;
  const cached = await getCached<CachedPath>(key);
  if (cached !== null) {
    // Invalidate cache if path contains blocked titles (shouldn't happen with v2, but safety check)
    if (pathContainsBlockedTitle(cached.path)) {
      console.log(`[SOLVER CACHE INVALIDATED] ${from} -> ${to}: path contains blocked titles`);
      return null;
    }
    console.log(`[SOLVER CACHE HIT] ${from} -> ${to}: distance=${cached.distance}, path=${cached.path?.length || 0} nodes`);
    return cached;
  }
  return null;
}

/**
 * Cache path result between two articles
 */
async function setCachedPath(from: string, to: string, result: CachedPath): Promise<void> {
  // Don't cache paths that contain blocked titles
  if (pathContainsBlockedTitle(result.path)) {
    console.log(`[SOLVER CACHE SKIP] ${from} -> ${to}: path contains blocked titles`);
    return;
  }
  const key = `${CACHE_KEYS.RESOLVE}path:${CACHE_VERSION}:${from}:${to}`;
  await setCache(key, result, PATH_CACHE_TTL);
  console.log(`[SOLVER CACHE SET] ${from} -> ${to}: distance=${result.distance}, path=${result.path?.length || 0} nodes`);
}

/**
 * Quick distance check for per-move updates
 * Uses smaller budget for fast response
 * Only READS from cache, does NOT write (to avoid caching suboptimal paths)
 */
export async function quickDistanceCheck(
  currentTitle: string,
  targetTitle: string
): Promise<DistanceResult> {
  const normalizedCurrent = normalizeTitle(currentTitle);
  const normalizedTarget = normalizeTitle(targetTitle);

  // Check cache first (read-only)
  const cached = await getCachedPath(normalizedCurrent, normalizedTarget);
  if (cached !== null && cached.status === 'POSSIBLE') {
    return {
      distance: cached.distance,
      status: 'KNOWN',
    };
  }

  // Same article
  if (normalizedCurrent === normalizedTarget) {
    return { distance: 0, status: 'KNOWN' };
  }

  // Run quick BFS (but don't cache the result - only full solver should cache)
  const result = await runBFS(
    normalizedCurrent,
    normalizedTarget,
    QUICK_MAX_DEPTH,
    QUICK_MAX_NODES,
    QUICK_MAX_TIME_MS
  );

  return {
    distance: result.distance ?? null,
    status: result.status === 'POSSIBLE' ? 'KNOWN' : 'UNKNOWN',
  };
}

/**
 * Full solver for feasibility checks (used at game start)
 * ALWAYS returns the full path when found
 */
export async function runSolver(
  startTitle: string,
  targetTitle: string,
  maxDepth: number = DEFAULT_MAX_DEPTH
): Promise<SolverResult> {
  const normalizedStart = normalizeTitle(startTitle);
  const normalizedTarget = normalizeTitle(targetTitle);

  // Check cache first - now returns full path!
  const cached = await getCachedPath(normalizedStart, normalizedTarget);
  if (cached !== null && cached.status === 'POSSIBLE' && cached.path) {
    return {
      status: 'POSSIBLE',
      distance: cached.distance ?? undefined,
      d_start: cached.distance ?? undefined,
      path: cached.path,
    };
  }

  // Run BFS to find path
  const result = await runBFS(
    normalizedStart,
    normalizedTarget,
    maxDepth,
    MAX_VISITED_NODES,
    MAX_TIME_MS
  );

  // Cache the result with full path
  if (result.status === 'POSSIBLE' && result.path) {
    await setCachedPath(normalizedStart, normalizedTarget, {
      distance: result.distance ?? null,
      path: result.path,
      status: result.status,
    });
  }

  return {
    ...result,
    d_start: result.distance,
  };
}

/**
 * Core BFS implementation with configurable limits
 */
async function runBFS(
  startTitle: string,
  targetTitle: string,
  maxDepth: number,
  maxNodes: number,
  maxTimeMs: number
): Promise<SolverResult> {
  // Same article
  if (startTitle === targetTitle) {
    return {
      status: 'POSSIBLE',
      distance: 0,
      path: [startTitle],
    };
  }

  const startTime = Date.now();
  
  // Forward and backward frontiers
  let forwardFrontier: Set<string> = new Set([startTitle]);
  let backwardFrontier: Set<string> = new Set([targetTitle]);
  
  // Visited sets with parent tracking
  const forwardVisited: Map<string, string | null> = new Map();
  const backwardVisited: Map<string, string | null> = new Map();
  
  forwardVisited.set(startTitle, null);
  backwardVisited.set(targetTitle, null);

  let forwardDepth = 0;
  let backwardDepth = 0;
  let totalVisited = 2;

  console.log(`[BFS] Starting: ${startTitle} -> ${targetTitle} (maxDepth=${maxDepth}, maxNodes=${maxNodes}, maxTime=${maxTimeMs}ms)`);

  // Bidirectional BFS
  while (
    forwardFrontier.size > 0 &&
    backwardFrontier.size > 0 &&
    forwardDepth + backwardDepth < maxDepth
  ) {
    // Check time budget
    if (Date.now() - startTime > maxTimeMs) {
      console.log(`[BFS] Time budget exceeded after ${Date.now() - startTime}ms`);
      return {
        status: 'UNKNOWN',
        reason: 'Time budget exceeded',
      };
    }

    // Check node budget
    if (totalVisited >= maxNodes) {
      console.log(`[BFS] Node budget exceeded: ${totalVisited} nodes`);
      return {
        status: 'UNKNOWN',
        reason: 'Node budget exceeded',
      };
    }

    // Expand the smaller frontier
    const expandForward = forwardFrontier.size <= backwardFrontier.size;
    
    if (expandForward) {
      const result = await expandFrontier(
        forwardFrontier,
        forwardVisited,
        backwardVisited,
        startTime,
        totalVisited,
        maxTimeMs,
        maxNodes
      );

      if (result.meetingPoint) {
        const path = reconstructPath(
          result.meetingPoint,
          forwardVisited,
          backwardVisited
        );
        console.log(`[BFS] Found path! ${path.join(' -> ')} (${path.length - 1} hops)`);
        return {
          status: 'POSSIBLE',
          distance: path.length - 1,
          path,
        };
      }

      if (result.budgetExceeded) {
        return {
          status: 'UNKNOWN',
          reason: result.reason,
        };
      }

      forwardFrontier = result.newFrontier;
      totalVisited = result.totalVisited;
      forwardDepth++;
    } else {
      const result = await expandFrontier(
        backwardFrontier,
        backwardVisited,
        forwardVisited,
        startTime,
        totalVisited,
        maxTimeMs,
        maxNodes
      );

      if (result.meetingPoint) {
        const path = reconstructPath(
          result.meetingPoint,
          forwardVisited,
          backwardVisited
        );
        console.log(`[BFS] Found path! ${path.join(' -> ')} (${path.length - 1} hops)`);
        return {
          status: 'POSSIBLE',
          distance: path.length - 1,
          path,
        };
      }

      if (result.budgetExceeded) {
        return {
          status: 'UNKNOWN',
          reason: result.reason,
        };
      }

      backwardFrontier = result.newFrontier;
      totalVisited = result.totalVisited;
      backwardDepth++;
    }
  }

  // Exhausted search within budget
  console.log(`[BFS] No path found within ${maxDepth} hops (visited ${totalVisited} nodes)`);
  return {
    status: 'NOT_POSSIBLE',
    reason: `No path found within ${maxDepth} hops`,
  };
}

interface ExpandResult {
  newFrontier: Set<string>;
  meetingPoint: string | null;
  budgetExceeded: boolean;
  reason?: string;
  totalVisited: number;
}

async function expandFrontier(
  frontier: Set<string>,
  visited: Map<string, string | null>,
  otherVisited: Map<string, string | null>,
  startTime: number,
  totalVisited: number,
  maxTimeMs: number,
  maxNodes: number
): Promise<ExpandResult> {
  const newFrontier: Set<string> = new Set();
  
  for (const node of frontier) {
    // Check time budget
    if (Date.now() - startTime > maxTimeMs) {
      return {
        newFrontier,
        meetingPoint: null,
        budgetExceeded: true,
        reason: 'Time budget exceeded',
        totalVisited,
      };
    }

    // Check node budget
    if (totalVisited >= maxNodes) {
      return {
        newFrontier,
        meetingPoint: null,
        budgetExceeded: true,
        reason: 'Node budget exceeded',
        totalVisited,
      };
    }

    try {
      const links = await getOutgoingLinks(node);
      
      for (const link of links) {
        const normalizedLink = normalizeTitle(link);
        
        // Skip blocked titles (citation pages that trivialize the game)
        if (isBlockedTitle(normalizedLink)) {
          continue;
        }
        
        // Check if we've met the other side
        if (otherVisited.has(normalizedLink)) {
          visited.set(normalizedLink, node);
          return {
            newFrontier,
            meetingPoint: normalizedLink,
            budgetExceeded: false,
            totalVisited,
          };
        }

        // Add to frontier if not visited
        if (!visited.has(normalizedLink)) {
          visited.set(normalizedLink, node);
          newFrontier.add(normalizedLink);
          totalVisited++;

          if (totalVisited >= maxNodes) {
            return {
              newFrontier,
              meetingPoint: null,
              budgetExceeded: true,
              reason: 'Node budget exceeded',
              totalVisited,
            };
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching links for ${node}:`, error);
    }
  }

  return {
    newFrontier,
    meetingPoint: null,
    budgetExceeded: false,
    totalVisited,
  };
}

function reconstructPath(
  meetingPoint: string,
  forwardVisited: Map<string, string | null>,
  backwardVisited: Map<string, string | null>
): string[] {
  // Build forward path (start -> meeting point)
  const forwardPath: string[] = [];
  let current: string | null = meetingPoint;
  
  while (current !== null) {
    forwardPath.unshift(current);
    current = forwardVisited.get(current) ?? null;
  }

  // Build backward path (meeting point -> target)
  const backwardPath: string[] = [];
  current = backwardVisited.get(meetingPoint) ?? null;
  
  while (current !== null) {
    backwardPath.push(current);
    current = backwardVisited.get(current) ?? null;
  }

  return [...forwardPath, ...backwardPath];
}

/**
 * Full path finder (main export)
 */
export async function findShortestPath(
  startTitle: string,
  targetTitle: string,
  maxDepth: number = DEFAULT_MAX_DEPTH
): Promise<SolverResult> {
  return runSolver(startTitle, targetTitle, maxDepth);
}

/**
 * Extended path finder with much larger limits
 */
export async function findShortestPathExtended(
  startTitle: string,
  targetTitle: string,
  maxDepth: number = 8
): Promise<SolverResult> {
  const normalizedStart = normalizeTitle(startTitle);
  const normalizedTarget = normalizeTitle(targetTitle);

  // Check cache first
  const cached = await getCachedPath(normalizedStart, normalizedTarget);
  if (cached !== null && cached.status === 'POSSIBLE' && cached.path) {
    return {
      status: 'POSSIBLE',
      distance: cached.distance ?? undefined,
      d_start: cached.distance ?? undefined,
      path: cached.path,
    };
  }

  const result = await runBFS(
    normalizedStart,
    normalizedTarget,
    maxDepth,
    200000, // Much larger node budget
    30000   // 30 second timeout
  );

  // Cache the result
  if (result.status === 'POSSIBLE' && result.path) {
    await setCachedPath(normalizedStart, normalizedTarget, {
      distance: result.distance ?? null,
      path: result.path,
      status: result.status,
    });
  }

  return {
    ...result,
    d_start: result.distance,
  };
}

/**
 * Get distance to target (legacy compatibility)
 */
export async function getDistanceToTarget(
  currentTitle: string,
  targetTitle: string
): Promise<DistanceResult> {
  return quickDistanceCheck(currentTitle, targetTitle);
}

/**
 * Check feasibility (legacy compatibility)
 */
export async function checkFeasibility(
  startTitle: string,
  targetTitle: string,
  maxDepth: number = DEFAULT_MAX_DEPTH
): Promise<SolverResult> {
  return runSolver(startTitle, targetTitle, maxDepth);
}
