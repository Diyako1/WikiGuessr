import { NextRequest, NextResponse } from 'next/server';
import { getGameSession, calculateScore } from '@/lib/game';
import { prisma } from '@/lib/db';
import { checkRateLimit } from '@/lib/redis';

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
    const { gameId } = body;

    if (!gameId) {
      return NextResponse.json(
        { error: 'gameId is required' },
        { status: 400 }
      );
    }

    const session = await getGameSession(gameId);
    if (!session) {
      return NextResponse.json(
        { error: 'Game session not found or expired' },
        { status: 404 }
      );
    }

    const timeMs = Date.now() - session.startedAt;
    const won = session.status === 'won';
    const score = won ? calculateScore(session.clicks, timeMs, session.dStart) : 0;

    let runId = gameId;

    // Try to store in database, but don't fail if DB is unavailable
    try {
      const run = await prisma.run.create({
        data: {
          startTitle: session.startTitle,
          targetTitle: session.targetTitle,
          timeMs,
          clicks: session.clicks,
          dStart: session.dStart,
          pathTitles: session.pathTitles,
          won,
          score,
        },
      });
      runId = run.id;
    } catch (dbError) {
      console.warn('Database unavailable, skipping run storage:', dbError);
      // Continue without storing - game results still work
    }

    return NextResponse.json(
      {
        runId,
        startTitle: session.startTitle,
        targetTitle: session.targetTitle,
        timeMs,
        clicks: session.clicks,
        dStart: session.dStart,
        pathTitles: session.pathTitles,
        won,
        score,
      },
      { headers: { 'X-RateLimit-Remaining': String(remaining) } }
    );
  } catch (error) {
    console.error('Game complete error:', error);
    return NextResponse.json(
      { error: 'Failed to complete game' },
      { status: 500 }
    );
  }
}
