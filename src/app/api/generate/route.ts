import { NextRequest, NextResponse } from 'next/server';
import { findShortestPath } from '@/lib/solver';
import { getDifficultyLabel } from '@/lib/game';
import { checkRateLimit } from '@/lib/redis';
import titlesData from '@/data/titles.json';

// More attempts for harder difficulties
const MAX_ATTEMPTS = 30;

const popularTitles = titlesData.titles;

function getRandomTitle(exclude?: string): string {
  const filtered = exclude ? popularTitles.filter(t => t !== exclude) : popularTitles;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

// Get two random titles that are likely to be far apart (different categories)
function getTwoDistantTitles(): [string, string] {
  // Pick from different halves of the shuffled list to increase distance
  const shuffled = [...popularTitles].sort(() => Math.random() - 0.5);
  const mid = Math.floor(shuffled.length / 2);
  const start = shuffled[Math.floor(Math.random() * mid)];
  const target = shuffled[mid + Math.floor(Math.random() * (shuffled.length - mid))];
  return [start, target];
}

// Difficulty ranges - STRICT matching
function getDifficultyRange(difficulty: string): { min: number; max: number } {
  switch (difficulty.toUpperCase()) {
    case 'EASY':
      return { min: 1, max: 2 };
    case 'MEDIUM':
      return { min: 2, max: 3 };
    case 'HARD':
      return { min: 3, max: 4 };
    case 'INSANE':
      return { min: 4, max: 10 };
    default:
      return { min: 2, max: 4 };
  }
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'anonymous';
  const { allowed, remaining } = await checkRateLimit(ip, 30);
  
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: { 'X-RateLimit-Remaining': String(remaining) } }
    );
  }

  try {
    const body = await request.json();
    const { 
      mode = 'BOTH', 
      startTitle: lockedStart, 
      targetTitle: lockedTarget, 
      difficulty = 'MEDIUM' 
    } = body;

    const { min: minHops, max: maxHops } = getDifficultyRange(difficulty);
    
    console.log(`[GENERATE] difficulty=${difficulty}, range=${minHops}-${maxHops}, mode=${mode}`);

    // Store candidates that are close but not exact
    let bestCandidate: { start: string; target: string; distance: number; path?: string[] } | null = null;

    // Try to find a valid pair - STRICT matching only
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let startTitle: string;
      let targetTitle: string;

      switch (mode) {
        case 'START_ONLY':
          if (!lockedTarget) {
            return NextResponse.json({ error: 'targetTitle required' }, { status: 400 });
          }
          targetTitle = lockedTarget;
          startTitle = getRandomTitle(targetTitle);
          break;
        case 'TARGET_ONLY':
          if (!lockedStart) {
            return NextResponse.json({ error: 'startTitle required' }, { status: 400 });
          }
          startTitle = lockedStart;
          targetTitle = getRandomTitle(startTitle);
          break;
        default:
          // For hard/insane, use distant title selection
          if (difficulty === 'HARD' || difficulty === 'INSANE') {
            [startTitle, targetTitle] = getTwoDistantTitles();
          } else {
            startTitle = getRandomTitle();
            targetTitle = getRandomTitle(startTitle);
          }
      }

      // Use larger search depth for harder difficulties
      const searchDepth = Math.max(maxHops + 2, 6);
      const result = await findShortestPath(startTitle, targetTitle, searchDepth);

      if (result.status === 'POSSIBLE' && result.distance !== undefined) {
        console.log(`[GENERATE] Attempt ${attempt + 1}: ${startTitle} -> ${targetTitle} = ${result.distance} hops`);
        
        // STRICT: Only accept if EXACTLY in range
        if (result.distance >= minHops && result.distance <= maxHops) {
          console.log(`[GENERATE] SUCCESS: Found exact match!`);
          return NextResponse.json({
            startTitle,
            targetTitle,
            status: 'POSSIBLE',
            dStart: result.distance,
            path: result.path,
            difficultyLabel: getDifficultyLabel(result.distance),
          }, { headers: { 'X-RateLimit-Remaining': String(remaining) } });
        }
        
        // Track best candidate for fallback (closest to target range)
        if (!bestCandidate || 
            Math.abs(result.distance - minHops) < Math.abs(bestCandidate.distance - minHops)) {
          bestCandidate = { 
            start: startTitle, 
            target: targetTitle, 
            distance: result.distance,
            path: result.path 
          };
        }
      }
    }

    // If we have a candidate that's reasonably close, use it with a note
    if (bestCandidate && bestCandidate.distance >= 1) {
      console.log(`[GENERATE] Using best candidate: ${bestCandidate.start} -> ${bestCandidate.target} (${bestCandidate.distance} hops)`);
      return NextResponse.json({
        startTitle: bestCandidate.start,
        targetTitle: bestCandidate.target,
        status: 'POSSIBLE',
        dStart: bestCandidate.distance,
        path: bestCandidate.path,
        difficultyLabel: getDifficultyLabel(bestCandidate.distance),
        note: `Best available: ${bestCandidate.distance} hops (requested ${minHops}-${maxHops})`,
      }, { headers: { 'X-RateLimit-Remaining': String(remaining) } });
    }

    return NextResponse.json(
      { error: `Couldn't generate a ${difficulty.toLowerCase()} pair. Please try again or select a different difficulty.` },
      { status: 422 }
    );
  } catch (error) {
    console.error('Generate error:', error);
    return NextResponse.json({ error: 'Failed to generate pair' }, { status: 500 });
  }
}
