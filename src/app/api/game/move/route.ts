import { NextRequest, NextResponse } from 'next/server';
import { quickDistanceCheck } from '@/lib/solver';
import { getGameSession, recordMove, calculateProgressFill, getDelta, getDistanceFromOptimalPath } from '@/lib/game';
import { getPageSummary, getOutgoingLinks, fetchPageHtml, canonicalTitle, isBlockedTitle } from '@/lib/wiki';
import { checkRateLimit } from '@/lib/redis';

export async function POST(request: NextRequest) {
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
    const body = await request.json();
    const { gameId, nextTitle } = body;

    if (!gameId || !nextTitle) {
      return NextResponse.json(
        { error: 'gameId and nextTitle are required' },
        { status: 400 }
      );
    }

    console.log(`[MOVE] Game ${gameId}: moving to "${nextTitle}"`);

    // Get current session
    const session = await getGameSession(gameId);
    if (!session) {
      return NextResponse.json(
        { error: 'Game session not found or expired' },
        { status: 404 }
      );
    }

    if (session.status !== 'active') {
      return NextResponse.json(
        { error: 'Game is not active', status: session.status },
        { status: 400 }
      );
    }

    // Normalize the next title using canonical normalization
    const normalizedNext = canonicalTitle(nextTitle);
    
    // Block navigation to excluded pages (citation/reference pages)
    if (isBlockedTitle(normalizedNext)) {
      console.log(`[MOVE] Blocked: "${normalizedNext}" is an excluded page`);
      return NextResponse.json(
        { error: 'This page is not available in the game' },
        { status: 400 }
      );
    }
    
    // Validate the move - check if nextTitle is an outgoing link of currentTitle
    const currentLinks = await getOutgoingLinks(session.currentTitle);
    const normalizedLinks = new Set(currentLinks.map(link => canonicalTitle(link)));
    
    if (!normalizedLinks.has(normalizedNext)) {
      console.log(`[MOVE] Invalid: "${normalizedNext}" not in ${normalizedLinks.size} links from "${session.currentTitle}"`);
      return NextResponse.json(
        { error: 'Invalid move: link not available from current page' },
        { status: 400 }
      );
    }

    // Start fetching page data immediately (don't wait for distance)
    const pageDataPromise = Promise.all([
      getPageSummary(normalizedNext),
      getOutgoingLinks(normalizedNext),
      fetchPageHtml(normalizedNext),
    ]);

    // Calculate distance - first try using the optimal path (instant, accurate)
    let dNow = getDistanceFromOptimalPath(normalizedNext, session.targetTitle, session.optimalPath);
    
    // If not on optimal path, try quick BFS (may return null if budget exceeded)
    if (dNow === null) {
      const distanceResult = await quickDistanceCheck(normalizedNext, session.targetTitle);
      dNow = distanceResult.distance;
    }
    
    const dPrev = session.dPrev;
    
    console.log(`[MOVE] Distance calc: dNow=${dNow}, dPrev=${dPrev}, onOptimalPath=${dNow !== null}`);

    // Record the move
    const updatedSession = await recordMove(gameId, normalizedNext, dNow);
    if (!updatedSession) {
      return NextResponse.json(
        { error: 'Failed to record move' },
        { status: 500 }
      );
    }

    // Wait for page data
    const [summary, links, htmlContent] = await pageDataPromise;

    // Calculate progress
    const progressFill = calculateProgressFill(session.dStart, dNow);
    const delta = getDelta(dPrev, dNow);

    console.log(`[MOVE] Success: "${normalizedNext}" (${links.length} links, d=${dNow}, delta=${delta})`);

    return NextResponse.json(
      {
        currentTitle: updatedSession.currentTitle,
        summary: summary ? {
          title: summary.title,
          displayTitle: summary.displaytitle,
          extract: summary.extract,
          description: summary.description,
          thumbnail: summary.thumbnail,
        } : null,
        links,
        htmlContent,
        clicks: updatedSession.clicks,
        d_now: dNow,
        dNow,
        dPrev,
        delta,
        progressFill,
        status: updatedSession.status,
        won: updatedSession.status === 'won',
        pathTitles: updatedSession.pathTitles,
      },
      { headers: { 'X-RateLimit-Remaining': String(remaining) } }
    );
  } catch (error) {
    console.error('Game move error:', error);
    return NextResponse.json(
      { error: 'Failed to process move' },
      { status: 500 }
    );
  }
}
