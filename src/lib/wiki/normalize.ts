/**
 * Canonical title normalization for Wikipedia links
 * Ensures consistent comparison between fetched links and href attributes
 */

/**
 * BLOCKLIST: These pages are permanently excluded from the game.
 * They are citation/reference pages that make the game trivial
 * (almost every article links to them, creating 2-hop shortcuts).
 */
export const BLOCKED_TITLES: Set<string> = new Set([
  // Identifiers - all variations
  'ISSN (identifier)',
  'ISSN',
  'EISSN (identifier)',
  'EISSN',
  'ISBN (identifier)',
  'ISBN',
  'Digital object identifier',
  'DOI (identifier)',
  'DOI',
  'Doi (identifier)',
  'PubMed Identifier',
  'PubMed',
  'PubMed Central',
  'PMID (identifier)',
  'PMID',
  'JSTOR (identifier)',
  'JSTOR',
  'OCLC (identifier)',
  'OCLC',
  'WorldCat',
  'Bibcode (identifier)',
  'Bibcode',
  'ArXiv (identifier)',
  'ArXiv',
  'Arxiv',
  'S2CID (identifier)',
  'S2CID',
  'Semantic Scholar',
  'Google Scholar',
  'Google Books',
  'HDL (identifier)',
  'HDL',
  'Handle System',
  'LCCN (identifier)',
  'LCCN',
  'Library of Congress Control Number',
  'PMC (identifier)',
  'PMC',
  'SSRN (identifier)',
  'SSRN',
  'Social Science Research Network',
  'Zbl (identifier)',
  'Zbl',
  'MR (identifier)',
  'MR',
  'Mathematical Reviews',
  'VIAF (identifier)',
  'VIAF',
  'GND (identifier)',
  'GND',
  'ISNI (identifier)',
  'ISNI',
  'ORCID (identifier)',
  'ORCID',
  // Archives
  'Wayback Machine',
  'Internet Archive',
  'Archive.org',
  'Web archive',
  'Wikiwix',
  'Archive.today',
  // Other common citation shortcuts
  'Cite web',
  'Citation needed',
  'Subscription required',
  'Registration required',
]);

// Create a lowercase version of blocked titles for case-insensitive matching
const BLOCKED_TITLES_LOWER: Set<string> = new Set(
  Array.from(BLOCKED_TITLES).map(t => t.toLowerCase())
);

/**
 * Check if a title is blocked (should be excluded from the game)
 * Uses case-insensitive matching
 */
export function isBlockedTitle(title: string): boolean {
  if (!title) return true;
  const normalized = canonicalTitle(title);
  // Check both exact match and case-insensitive match
  if (BLOCKED_TITLES.has(normalized)) return true;
  if (BLOCKED_TITLES_LOWER.has(normalized.toLowerCase())) return true;
  
  // Also check if the title contains "(identifier)" suffix - these are all citation pages
  if (normalized.toLowerCase().includes('(identifier)')) return true;
  
  return false;
}

/**
 * Filter out blocked titles from an array
 */
export function filterBlockedTitles(titles: string[]): string[] {
  return titles.filter(title => !isBlockedTitle(title));
}

/**
 * Filter out blocked titles from a Set
 */
export function filterBlockedTitlesSet(titles: Set<string>): Set<string> {
  const filtered = new Set<string>();
  for (const title of titles) {
    if (!isBlockedTitle(title)) {
      filtered.add(title);
    }
  }
  return filtered;
}

export function canonicalTitle(input: string | null | undefined): string {
  if (!input) return '';
  
  let title = input;
  
  // 1. Decode URL encoding (may need multiple passes for double-encoding)
  try {
    // Handle double-encoding
    let decoded = title;
    let prev = '';
    while (decoded !== prev && decoded.includes('%')) {
      prev = decoded;
      decoded = decodeURIComponent(decoded);
    }
    title = decoded;
  } catch {
    // If decoding fails, continue with original
  }
  
  // 2. Strip common prefixes
  if (title.startsWith('/wiki/')) {
    title = title.substring(6);
  } else if (title.startsWith('./')) {
    title = title.substring(2);
  } else if (title.startsWith('wiki/')) {
    title = title.substring(5);
  }
  
  // 3. Remove fragment (everything after #)
  const hashIndex = title.indexOf('#');
  if (hashIndex !== -1) {
    title = title.substring(0, hashIndex);
  }
  
  // 4. Replace underscores with spaces
  title = title.replace(/_/g, ' ');
  
  // 5. Trim and collapse multiple spaces
  title = title.trim().replace(/\s+/g, ' ');
  
  // 6. Wikipedia titles are case-sensitive for the first letter
  // but we normalize first letter to uppercase for consistency
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }
  
  return title;
}

/**
 * Check if a href is an internal Wikipedia article link
 * (not external, not special pages, not files, etc.)
 */
export function isInternalArticleLink(href: string | null | undefined): boolean {
  if (!href) return false;
  
  // Skip external links
  if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
    return false;
  }
  
  // Skip anchors-only
  if (href.startsWith('#')) {
    return false;
  }
  
  // Skip special namespaces
  const lowerHref = href.toLowerCase();
  const skipPrefixes = [
    'file:', 'image:', 'category:', 'template:', 'wikipedia:',
    'help:', 'portal:', 'special:', 'talk:', 'user:', 'mediawiki:',
    'module:', 'draft:'
  ];
  
  for (const prefix of skipPrefixes) {
    if (lowerHref.includes(prefix)) {
      return false;
    }
  }
  
  // Must be relative link or /wiki/ link
  return href.startsWith('./') || href.startsWith('/wiki/') || 
         (!href.startsWith('/') && !href.includes(':'));
}

/**
 * Create a normalized Set from an array of titles for O(1) lookup
 */
export function createLinkSet(titles: string[]): Set<string> {
  const set = new Set<string>();
  for (const title of titles) {
    const normalized = canonicalTitle(title);
    if (normalized) {
      set.add(normalized);
    }
  }
  return set;
}
