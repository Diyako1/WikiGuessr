// Wikipedia API client with caching and rate limiting

import {
  CACHE_KEYS,
  TTL,
  getCached,
  setCache,
} from '@/lib/redis';
import { canonicalTitle, isBlockedTitle } from './normalize';

const USER_AGENT =
  'WikiGuessr/0.1 (https://github.com/Diyako1/WikiGuessr; purpose: educational game)';

const BASE_URL = 'https://en.wikipedia.org';
const ACTION_API = `${BASE_URL}/w/api.php`;
const REST_API = `${BASE_URL}/api/rest_v1`;

// Exponential backoff settings
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 500;

interface WikiApiResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface SearchResult {
  title: string;
  description?: string;
  snippet?: string;
}

interface PageSummary {
  title: string;
  displaytitle: string;
  extract: string;
  description?: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
}

/**
 * Make a request with exponential backoff for rate limiting
 */
async function fetchWithBackoff(
  url: string,
  options: RequestInit = {},
  retries = 0
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': USER_AGENT,
      ...options.headers,
    },
  });

  // Handle maxlag and rate limiting
  if (response.status === 429 || response.headers.get('retry-after')) {
    if (retries >= MAX_RETRIES) {
      throw new Error('Rate limit exceeded after max retries');
    }

    const retryAfter = response.headers.get('retry-after');
    const delay = retryAfter
      ? parseInt(retryAfter, 10) * 1000
      : INITIAL_BACKOFF_MS * Math.pow(2, retries);

    await new Promise((resolve) => setTimeout(resolve, delay));
    return fetchWithBackoff(url, options, retries + 1);
  }

  // Handle maxlag response from MediaWiki
  const text = await response.clone().text();
  if (text.includes('Waiting for') && text.includes('maxlag')) {
    if (retries >= MAX_RETRIES) {
      throw new Error('Maxlag exceeded after max retries');
    }

    const delay = INITIAL_BACKOFF_MS * Math.pow(2, retries);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return fetchWithBackoff(url, options, retries + 1);
  }

  return response;
}

/**
 * Normalize a Wikipedia title for consistent caching
 */
export function normalizeTitle(title: string): string {
  return canonicalTitle(title);
}

/**
 * Encode title for URL
 */
export function encodeTitle(title: string): string {
  return encodeURIComponent(normalizeTitle(title).replace(/ /g, '_'));
}

/**
 * Search Wikipedia for articles matching a query
 */
export async function searchWikipedia(
  query: string,
  limit = 8
): Promise<SearchResult[]> {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  // Check cache
  const cacheKey = `${CACHE_KEYS.SEARCH}${normalizedQuery}`;
  const cached = await getCached<SearchResult[]>(cacheKey);
  if (cached) {
    console.log(`[CACHE HIT] search:${normalizedQuery}`);
    return cached;
  }

  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    list: 'search',
    srsearch: query,
    srlimit: String(limit),
    srprop: 'snippet',
    srnamespace: '0',
    maxlag: '5',
  });

  const response = await fetchWithBackoff(`${ACTION_API}?${params}`);
  const data: WikiApiResponse = await response.json();

  const results: SearchResult[] = (data.query?.search || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (item: any) => ({
      title: item.title,
      snippet: item.snippet?.replace(/<[^>]*>/g, '').substring(0, 100),
    })
  );

  await setCache(cacheKey, results, TTL.SEARCH);
  console.log(`[CACHE MISS] search:${normalizedQuery} -> ${results.length} results`);
  return results;
}

/**
 * Resolve a query to its canonical Wikipedia title (top search result)
 */
export async function resolveTitle(query: string): Promise<string | null> {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return null;

  // Check cache
  const cacheKey = `${CACHE_KEYS.RESOLVE}${normalizedQuery}`;
  const cached = await getCached<string>(cacheKey);
  if (cached) {
    console.log(`[CACHE HIT] resolve:${normalizedQuery}`);
    return cached;
  }

  const results = await searchWikipedia(query, 1);
  if (results.length === 0) return null;

  const resolvedTitle = results[0].title;
  await setCache(cacheKey, resolvedTitle, TTL.RESOLVE);
  console.log(`[CACHE MISS] resolve:${normalizedQuery} -> ${resolvedTitle}`);
  return resolvedTitle;
}

/**
 * Get page summary from REST API
 */
export async function getPageSummary(
  title: string
): Promise<PageSummary | null> {
  const normalizedTitle = normalizeTitle(title);
  const cacheKey = `${CACHE_KEYS.SUMMARY}${normalizedTitle}`;

  // Check cache
  const cached = await getCached<PageSummary>(cacheKey);
  if (cached) {
    console.log(`[CACHE HIT] summary:${normalizedTitle}`);
    return cached;
  }

  const encodedTitle = encodeTitle(title);
  const url = `${REST_API}/page/summary/${encodedTitle}`;

  try {
    const response = await fetchWithBackoff(url);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch summary: ${response.status}`);
    }

    const data = await response.json();
    // Strip HTML tags from displaytitle (Wikipedia sometimes includes <span> tags)
    let displayTitle = data.displaytitle || data.title;
    displayTitle = displayTitle.replace(/<[^>]*>/g, '');
    
    const summary: PageSummary = {
      title: data.title,
      displaytitle: displayTitle,
      extract: data.extract || '',
      description: data.description,
      thumbnail: data.thumbnail,
    };

    await setCache(cacheKey, summary, TTL.SUMMARY);
    console.log(`[CACHE MISS] summary:${normalizedTitle}`);
    return summary;
  } catch (error) {
    console.error('Error fetching page summary:', error);
    return null;
  }
}

// Cache version for links - increment to invalidate old caches
// v2: Added blocklist filtering for citation pages
const LINKS_CACHE_VERSION = 'v2';

/**
 * Get outgoing links from a Wikipedia page
 * Uses FULL PAGINATION to get ALL links
 * Filters out blocked titles (citation/reference pages)
 */
export async function getOutgoingLinks(title: string): Promise<string[]> {
  const normalizedTitle = normalizeTitle(title);
  const cacheKey = `${CACHE_KEYS.LINKS}${LINKS_CACHE_VERSION}:${normalizedTitle}`;

  // Check cache
  const cached = await getCached<string[]>(cacheKey);
  if (cached) {
    // Filter cached results in case any blocked titles slipped through
    const filtered = cached.filter(link => !isBlockedTitle(link));
    console.log(`[CACHE HIT] links:${normalizedTitle} (${filtered.length} links, filtered from ${cached.length})`);
    return filtered;
  }

  const links: Set<string> = new Set();
  let plcontinue: string | undefined;
  let iterations = 0;
  const MAX_ITERATIONS = 20; // Safety limit

  console.log(`[FETCHING LINKS] ${normalizedTitle} - starting pagination...`);

  do {
    iterations++;
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      titles: normalizedTitle,
      prop: 'links',
      plnamespace: '0', // Main namespace only
      pllimit: 'max',   // Get maximum per request (500)
      redirects: '1',
      maxlag: '5',
    });

    if (plcontinue) {
      params.set('plcontinue', plcontinue);
    }

    const response = await fetchWithBackoff(`${ACTION_API}?${params}`);
    const data: WikiApiResponse = await response.json();

    // Handle redirects - get the actual page title
    const pages = data.query?.pages || [];
    if (pages.length === 0) break;

    const page = pages[0];
    if (page.missing) {
      console.log(`[LINKS] Page not found: ${normalizedTitle}`);
      break;
    }

    // Extract links from this batch
    const pageLinks = page.links || [];
    const beforeCount = links.size;
    
    for (const link of pageLinks) {
      const linkTitle = canonicalTitle(link.title);
      // Filter out self-links AND blocked titles
      if (linkTitle && linkTitle !== normalizedTitle && !isBlockedTitle(linkTitle)) {
        links.add(linkTitle);
      }
    }

    console.log(`[LINKS] Iteration ${iterations}: +${links.size - beforeCount} links (total: ${links.size})`);

    // Check for continuation
    plcontinue = data.continue?.plcontinue;
    
  } while (plcontinue && iterations < MAX_ITERATIONS);

  const linksArray = Array.from(links);
  await setCache(cacheKey, linksArray, TTL.LINKS);
  console.log(`[CACHE MISS] links:${normalizedTitle} -> ${linksArray.length} total links (${iterations} API calls)`);
  
  return linksArray;
}

/**
 * Get page HTML content for rendering
 * Cached separately from links
 */
export async function fetchPageHtml(title: string): Promise<string> {
  const normalizedTitle = normalizeTitle(title);
  const cacheKey = `html:${normalizedTitle}`;

  // Check cache
  const cached = await getCached<string>(cacheKey);
  if (cached) {
    console.log(`[CACHE HIT] html:${normalizedTitle}`);
    return cached;
  }

  const params = new URLSearchParams({
    action: 'parse',
    format: 'json',
    page: normalizedTitle,
    prop: 'text',
    disableeditsection: 'true',
    disabletoc: 'true',
    maxlag: '5',
  });

  try {
    const response = await fetchWithBackoff(`${ACTION_API}?${params}`);
    const data: WikiApiResponse = await response.json();

    if (data.error) {
      console.error(`[HTML] Error fetching ${normalizedTitle}:`, data.error);
      return '';
    }

    const html = data.parse?.text?.['*'] || '';
    
    // Cache the HTML
    await setCache(cacheKey, html, TTL.SUMMARY); // Same TTL as summary
    console.log(`[CACHE MISS] html:${normalizedTitle} (${html.length} chars)`);
    
    return html;
  } catch (error) {
    console.error('Error fetching page HTML:', error);
    return '';
  }
}

/**
 * Check if a Wikipedia page exists
 */
export async function pageExists(title: string): Promise<boolean> {
  const summary = await getPageSummary(title);
  return summary !== null;
}

/**
 * Get a random Wikipedia article title from a curated list or API
 */
export async function getRandomArticle(): Promise<string> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    list: 'random',
    rnnamespace: '0',
    rnlimit: '1',
    maxlag: '5',
  });

  const response = await fetchWithBackoff(`${ACTION_API}?${params}`);
  const data: WikiApiResponse = await response.json();

  return data.query?.random?.[0]?.title || 'Wikipedia';
}
