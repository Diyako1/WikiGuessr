import { NextRequest, NextResponse } from 'next/server';
import { findShortestPathExtended } from '@/lib/solver';
import { checkRateLimit } from '@/lib/redis';

export async function POST(request: NextRequest) {
  // Rate limiting - lower limit since this is expensive
  const ip = request.headers.get('x-forwarded-for') || 'anonymous';
  const { allowed, remaining } = await checkRateLimit(ip, 10);
  
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
    const { startTitle, targetTitle, maxDepth = 8 } = body;

    if (!startTitle || !targetTitle) {
      return NextResponse.json(
        { error: 'startTitle and targetTitle are required' },
        { status: 400 }
      );
    }

    const result = await findShortestPathExtended(startTitle, targetTitle, maxDepth);

    return NextResponse.json(
      {
        status: result.status,
        distance: result.distance,
        path: result.path,
        reason: result.reason,
      },
      { headers: { 'X-RateLimit-Remaining': String(remaining) } }
    );
  } catch (error) {
    console.error('Path finding error:', error);
    return NextResponse.json(
      { error: 'Failed to find path' },
      { status: 500 }
    );
  }
}
