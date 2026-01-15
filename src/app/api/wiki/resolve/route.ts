import { NextRequest, NextResponse } from 'next/server';
import { resolveTitle } from '@/lib/wiki';
import { checkRateLimit } from '@/lib/redis';

export async function GET(request: NextRequest) {
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

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ title: null });
  }

  try {
    const title = await resolveTitle(query);
    return NextResponse.json(
      { title },
      { headers: { 'X-RateLimit-Remaining': String(remaining) } }
    );
  } catch (error) {
    console.error('Resolve error:', error);
    return NextResponse.json(
      { error: 'Failed to resolve title' },
      { status: 500 }
    );
  }
}
