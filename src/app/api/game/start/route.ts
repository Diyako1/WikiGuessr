import { NextRequest, NextResponse } from 'next/server';
import { findShortestPath } from '@/lib/solver';
import { createGameSession } from '@/lib/game';
import { checkRateLimit } from '@/lib/redis';
import { isBlockedTitle, canonicalTitle } from '@/lib/wiki';

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip = request.headers.get('x-forwarded-for') || 'anonymous';
  const { allowed, remaining } = await checkRateLimit(ip, 30);
  
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { 
        status: 429,
        headers: { 'X-RateLimit-Remaining': String(remaining) }
      }
    );
  }

  try {
    const body = await request.json();
    const { startTitle, targetTitle } = body;

    if (!startTitle || !targetTitle) {
      return NextResponse.json(
        { error: 'startTitle and targetTitle are required' },
        { status: 400 }
      );
    }

    // Block excluded pages from being used as start or target
    const normalizedStart = canonicalTitle(startTitle);
    const normalizedTarget = canonicalTitle(targetTitle);
    
    if (isBlockedTitle(normalizedStart)) {
      return NextResponse.json(
        { error: `"${startTitle}" cannot be used as a start page in this game` },
        { status: 400 }
      );
    }
    
    if (isBlockedTitle(normalizedTarget)) {
      return NextResponse.json(
        { error: `"${targetTitle}" cannot be used as a target page in this game` },
        { status: 400 }
      );
    }

    console.log(`[GAME START] Finding path: ${startTitle} -> ${targetTitle}`);

    // Find the shortest path - this gives us both feasibility AND the optimal path
    const result = await findShortestPath(startTitle, targetTitle);

    if (result.status !== 'POSSIBLE' || result.distance === undefined) {
      return NextResponse.json(
        { 
          error: 'Path is not feasible or could not be verified',
          status: result.status,
          reason: result.reason
        },
        { status: 400 }
      );
    }

    console.log(`[GAME START] Path found: ${result.path?.join(' -> ')}`);

    // Create game session WITH the optimal path stored
    const session = await createGameSession(
      startTitle, 
      targetTitle, 
      result.distance,
      result.path // Store the optimal path!
    );

    return NextResponse.json(
      {
        gameId: session.id,
        dStart: session.dStart,
        startTitle: session.startTitle,
        targetTitle: session.targetTitle,
        optimalPath: session.optimalPath, // Return it too
      },
      { headers: { 'X-RateLimit-Remaining': String(remaining) } }
    );
  } catch (error) {
    console.error('Game start error:', error);
    return NextResponse.json(
      { error: 'Failed to start game' },
      { status: 500 }
    );
  }
}
