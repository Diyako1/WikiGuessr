import { NextRequest, NextResponse } from 'next/server';
import { checkFeasibility } from '@/lib/solver';
import { checkRateLimit } from '@/lib/redis';

export async function POST(request: NextRequest) {
  // Rate limiting - more strict for solver
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
    const { startTitle, targetTitle, maxDepth = 7 } = body;

    if (!startTitle || !targetTitle) {
      return NextResponse.json(
        { error: 'startTitle and targetTitle are required' },
        { status: 400 }
      );
    }

    const result = await checkFeasibility(startTitle, targetTitle, maxDepth);

    return NextResponse.json(
      {
        status: result.status,
        dStart: result.distance,
        path: result.path, // Include the path for later use
        reason: result.reason,
      },
      { headers: { 'X-RateLimit-Remaining': String(remaining) } }
    );
  } catch (error) {
    console.error('Feasibility check error:', error);
    return NextResponse.json(
      { error: 'Failed to check feasibility' },
      { status: 500 }
    );
  }
}
