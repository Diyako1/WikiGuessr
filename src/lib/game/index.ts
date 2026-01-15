/**
 * Game session management with Redis
 */

import { v4 as uuidv4 } from 'uuid';
import { CACHE_KEYS, TTL, getCached, setCache } from '@/lib/redis';
import { normalizeTitle } from '@/lib/wiki';

export interface GameSession {
  id: string;
  startTitle: string;
  targetTitle: string;
  currentTitle: string;
  dStart: number;
  dPrev: number | null;
  clicks: number;
  pathTitles: string[];
  startedAt: number;
  status: 'active' | 'won' | 'abandoned';
  optimalPath?: string[]; // Store the optimal path when game is created
}

/**
 * Create a new game session
 */
export async function createGameSession(
  startTitle: string,
  targetTitle: string,
  dStart: number,
  optimalPath?: string[]
): Promise<GameSession> {
  const normalizedStart = normalizeTitle(startTitle);
  const normalizedTarget = normalizeTitle(targetTitle);

  const session: GameSession = {
    id: uuidv4(),
    startTitle: normalizedStart,
    targetTitle: normalizedTarget,
    currentTitle: normalizedStart,
    dStart,
    dPrev: dStart,
    clicks: 0,
    pathTitles: [normalizedStart],
    startedAt: Date.now(),
    status: 'active',
    optimalPath: optimalPath || undefined,
  };

  const key = `${CACHE_KEYS.GAME}${session.id}`;
  await setCache(key, session, TTL.GAME);

  return session;
}

/**
 * Get a game session by ID
 */
export async function getGameSession(
  gameId: string
): Promise<GameSession | null> {
  const key = `${CACHE_KEYS.GAME}${gameId}`;
  return getCached<GameSession>(key);
}

/**
 * Update a game session
 */
export async function updateGameSession(
  session: GameSession
): Promise<void> {
  const key = `${CACHE_KEYS.GAME}${session.id}`;
  await setCache(key, session, TTL.GAME);
}

/**
 * Record a move in the game
 */
export async function recordMove(
  gameId: string,
  nextTitle: string,
  dNow: number | null
): Promise<GameSession | null> {
  const session = await getGameSession(gameId);
  if (!session || session.status !== 'active') {
    return null;
  }

  const normalizedNext = normalizeTitle(nextTitle);

  session.currentTitle = normalizedNext;
  session.clicks += 1;
  session.pathTitles.push(normalizedNext);
  
  if (dNow !== null) {
    session.dPrev = dNow;
  }

  // Check win condition
  if (normalizedNext === session.targetTitle) {
    session.status = 'won';
  }

  await updateGameSession(session);
  return session;
}

/**
 * Calculate distance from current position using the optimal path
 * If the player is on a page in the optimal path, we know exactly how far they are
 * Otherwise, returns null (unknown)
 */
export function getDistanceFromOptimalPath(
  currentTitle: string,
  targetTitle: string,
  optimalPath?: string[]
): number | null {
  const normalizedCurrent = normalizeTitle(currentTitle);
  const normalizedTarget = normalizeTitle(targetTitle);
  
  // If we're at the target, distance is 0
  if (normalizedCurrent === normalizedTarget) {
    return 0;
  }
  
  // If we have an optimal path, check if we're on it
  if (optimalPath && optimalPath.length > 0) {
    const currentIndex = optimalPath.findIndex(
      title => normalizeTitle(title) === normalizedCurrent
    );
    
    if (currentIndex !== -1) {
      // We're on the optimal path - distance is remaining hops to target
      const targetIndex = optimalPath.length - 1;
      return targetIndex - currentIndex;
    }
  }
  
  return null; // Not on optimal path, distance unknown from this method
}

/**
 * Calculate progress fill based on distance
 */
export function calculateProgressFill(
  dStart: number,
  dNow: number | null
): number {
  if (dNow === null || dStart === 0) return 0;
  return Math.max(0, Math.min(1, (dStart - dNow) / dStart));
}

/**
 * Determine delta direction
 */
export function getDelta(
  dPrev: number | null,
  dNow: number | null
): 'CLOSER' | 'FARTHER' | 'SAME' | 'UNKNOWN' {
  if (dNow === null || dPrev === null) return 'UNKNOWN';
  if (dNow < dPrev) return 'CLOSER';
  if (dNow > dPrev) return 'FARTHER';
  return 'SAME';
}

/**
 * Calculate score for a completed game
 */
export function calculateScore(
  clicks: number,
  timeMs: number,
  dStart: number
): number {
  const timeSeconds = timeMs / 1000;
  const base = Math.max(0, 10000 - clicks * 650 - timeSeconds * 8);

  // Difficulty multiplier based on dStart
  let multiplier = 1.0;
  if (dStart >= 8) multiplier = 1.8;
  else if (dStart >= 6) multiplier = 1.5;
  else if (dStart >= 4) multiplier = 1.2;

  return Math.floor(base * multiplier);
}

/**
 * Get difficulty label from distance
 * Realistic ranges based on Wikipedia's high connectivity
 */
export function getDifficultyLabel(dStart: number): string {
  if (dStart >= 4) return 'INSANE';
  if (dStart >= 3) return 'HARD';
  if (dStart >= 2) return 'MEDIUM';
  return 'EASY';
}

/**
 * Get difficulty range for generation
 * Realistic ranges:
 * - Easy: 1-2 hops (most pairs)
 * - Medium: 2-3 hops  
 * - Hard: 3-4 hops
 * - Insane: 4+ hops (rare)
 */
export function getDifficultyRange(
  difficulty: string
): { min: number; max: number } {
  switch (difficulty.toUpperCase()) {
    case 'EASY':
      return { min: 1, max: 2 };
    case 'MEDIUM':
      return { min: 2, max: 3 };
    case 'HARD':
      return { min: 3, max: 4 };
    case 'INSANE':
      return { min: 4, max: 7 };
    default:
      return { min: 2, max: 4 };
  }
}
