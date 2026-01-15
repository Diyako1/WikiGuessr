import { NextRequest, NextResponse } from 'next/server';
import { getPageSummary, getOutgoingLinks, fetchPageHtml, normalizeTitle } from '@/lib/wiki';
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
  const title = searchParams.get('title');

  if (!title || title.trim().length === 0) {
    return NextResponse.json(
      { error: 'Title is required' },
      { status: 400 }
    );
  }

  const normalizedTitle = normalizeTitle(title);
  console.log(`[PAGE API] Fetching: ${normalizedTitle}`);

  try {
    // Fetch all data in parallel (all use caching)
    const [summary, links, htmlContent] = await Promise.all([
      getPageSummary(normalizedTitle),
      getOutgoingLinks(normalizedTitle),
      fetchPageHtml(normalizedTitle),
    ]);

    if (!summary) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    console.log(`[PAGE API] Success: ${normalizedTitle} (${links.length} links, ${htmlContent.length} chars HTML)`);

    return NextResponse.json(
      {
        title: normalizedTitle,
        displayTitle: summary.displaytitle,
        extract: summary.extract,
        description: summary.description,
        thumbnail: summary.thumbnail,
        links,
        htmlContent,
      },
      { headers: { 'X-RateLimit-Remaining': String(remaining) } }
    );
  } catch (error) {
    console.error('Page fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch page' },
      { status: 500 }
    );
  }
}
