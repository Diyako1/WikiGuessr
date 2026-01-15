import { NextRequest, NextResponse } from 'next/server';
import { getGameSession, calculateProgressFill } from '@/lib/game';
import { getPageSummary, getOutgoingLinks } from '@/lib/wiki';
import { checkRateLimit } from '@/lib/redis';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  // Rate limiting
  const ip = request.headers.get('x-forwarded-for') || 'anonymous';
  const { allowed, remaining } = await checkRateLimit(ip, 120);
  
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
    const { gameId } = await params;

    const session = await getGameSession(gameId);
    if (!session) {
      return NextResponse.json(
        { error: 'Game session not found or expired' },
        { status: 404 }
      );
    }

    // Get current page data
    const [summary, links] = await Promise.all([
      getPageSummary(session.currentTitle),
      getOutgoingLinks(session.currentTitle),
    ]);

    const progressFill = calculateProgressFill(session.dStart, session.dPrev);

    return NextResponse.json(
      {
        id: session.id,
        startTitle: session.startTitle,
        targetTitle: session.targetTitle,
        currentTitle: session.currentTitle,
        dStart: session.dStart,
        dPrev: session.dPrev,
        clicks: session.clicks,
        pathTitles: session.pathTitles,
        startedAt: session.startedAt,
        status: session.status,
        progressFill,
        optimalPath: session.optimalPath, // Include the pre-computed optimal path
        summary: summary ? {
          title: summary.title,
          displayTitle: summary.displaytitle,
          extract: summary.extract,
          description: summary.description,
          thumbnail: summary.thumbnail,
        } : null,
        links,
      },
      { headers: { 'X-RateLimit-Remaining': String(remaining) } }
    );
  } catch (error) {
    console.error('Game fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch game' },
      { status: 500 }
    );
  }
}
