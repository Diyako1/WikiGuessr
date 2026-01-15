'use client';

import React, { useMemo, useRef, useEffect } from 'react';

interface WikiArticleProps {
  htmlContent: string;
  links: string[];
  onLinkClick: (title: string) => void;
  targetTitle: string;
  disabled: boolean;
}

/**
 * Canonical title normalization - must match server-side logic
 */
function canonicalTitle(input: string | null | undefined): string {
  if (!input) return '';
  
  let title = input;
  
  // Decode URL encoding (handle double-encoding)
  try {
    let decoded = title;
    let prev = '';
    while (decoded !== prev && decoded.includes('%')) {
      prev = decoded;
      decoded = decodeURIComponent(decoded);
    }
    title = decoded;
  } catch {
    // Continue with original if decoding fails
  }
  
  // Strip prefixes
  if (title.startsWith('/wiki/')) {
    title = title.substring(6);
  } else if (title.startsWith('./')) {
    title = title.substring(2);
  } else if (title.startsWith('wiki/')) {
    title = title.substring(5);
  }
  
  // Remove fragment
  const hashIndex = title.indexOf('#');
  if (hashIndex !== -1) {
    title = title.substring(0, hashIndex);
  }
  
  // Normalize spacing
  title = title.replace(/_/g, ' ').trim().replace(/\s+/g, ' ');
  
  // Capitalize first letter
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }
  
  return title;
}

/**
 * Check if href is an internal article link
 */
function isInternalLink(href: string | null): boolean {
  if (!href) return false;
  if (href.startsWith('http') || href.startsWith('//') || href.startsWith('#')) return false;
  
  const lower = href.toLowerCase();
  const skip = ['file:', 'image:', 'category:', 'template:', 'wikipedia:', 
                'help:', 'portal:', 'special:', 'talk:', 'user:', 'mediawiki:'];
  for (const prefix of skip) {
    if (lower.includes(prefix)) return false;
  }
  
  return href.startsWith('./') || href.startsWith('/wiki/') || 
         (!href.startsWith('/') && !href.includes(':'));
}

export default function WikiArticle({
  htmlContent,
  links,
  onLinkClick,
  targetTitle,
  disabled,
}: WikiArticleProps) {
  const articleRef = useRef<HTMLDivElement>(null);

  // Create normalized Set for O(1) lookups
  const linkSet = useMemo(() => {
    const set = new Set<string>();
    for (const link of links) {
      const normalized = canonicalTitle(link);
      if (normalized) set.add(normalized);
    }
    console.log(`[WikiArticle] Created linkSet with ${set.size} normalized titles`);
    return set;
  }, [links]);

  const normalizedTarget = useMemo(() => canonicalTitle(targetTitle), [targetTitle]);

  // Process HTML once with memoization
  const processedHtml = useMemo(() => {
    if (!htmlContent) return '';

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    const anchors = tempDiv.querySelectorAll('a');
    let matchedCount = 0;
    let skippedCount = 0;

    anchors.forEach(a => {
      const href = a.getAttribute('href');
      
      // Skip non-internal links
      if (!isInternalLink(href)) {
        a.style.color = '#72777d';
        a.style.cursor = 'default';
        a.style.pointerEvents = 'none';
        a.removeAttribute('href');
        skippedCount++;
        return;
      }

      // Normalize the href to get title
      const linkTitle = canonicalTitle(href);
      
      // O(1) lookup in Set
      const isValidLink = linkSet.has(linkTitle);
      const isTargetLink = linkTitle === normalizedTarget;

      if (isValidLink) {
        matchedCount++;
        a.setAttribute('data-wiki-link', linkTitle);
        a.removeAttribute('href');
        a.style.color = isTargetLink ? '#00af89' : '#0645ad';
        a.style.cursor = disabled ? 'default' : 'pointer';
        a.style.textDecoration = 'none';
        
        if (isTargetLink) {
          a.style.fontWeight = 'bold';
          a.style.background = '#d5fdf4';
          a.style.padding = '0 3px';
          a.style.borderRadius = '2px';
        }
      } else {
        // Link not in our game links - disable it
        a.style.color = '#72777d';
        a.style.cursor = 'default';
        a.style.pointerEvents = 'none';
        a.removeAttribute('href');
        skippedCount++;
      }
    });

    console.log(`[WikiArticle] Processed ${anchors.length} anchors: ${matchedCount} clickable, ${skippedCount} disabled`);
    return tempDiv.innerHTML;
  }, [htmlContent, linkSet, normalizedTarget, disabled]);

  // Event delegation for clicks
  useEffect(() => {
    const articleElement = articleRef.current;
    if (!articleElement || disabled) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const linkElement = target.closest('a[data-wiki-link]') as HTMLAnchorElement | null;

      if (linkElement) {
        event.preventDefault();
        event.stopPropagation();
        const title = linkElement.getAttribute('data-wiki-link');
        if (title) {
          console.log(`[WikiArticle] Link clicked: "${title}"`);
          onLinkClick(title);
        }
      }
    };

    // Capture phase to ensure we handle clicks before anything else
    articleElement.addEventListener('click', handleClick, true);

    return () => {
      articleElement.removeEventListener('click', handleClick, true);
    };
  }, [onLinkClick, disabled]);

  if (!htmlContent) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px',
        color: '#54595d',
        fontFamily: 'sans-serif'
      }}>
        Loading article content...
      </div>
    );
  }

  return (
    <div 
      ref={articleRef}
      className="wiki-content"
      style={{
        fontFamily: "'Linux Libertine', 'Georgia', 'Times', serif",
        fontSize: '14px',
        lineHeight: '1.6',
        color: '#202122'
      }}
    >
      <style jsx global>{`
        .wiki-content {
          word-wrap: break-word;
        }
        .wiki-content h1, 
        .wiki-content h2, 
        .wiki-content h3, 
        .wiki-content h4, 
        .wiki-content h5, 
        .wiki-content h6 {
          font-family: 'Linux Libertine', 'Georgia', 'Times', serif;
          font-weight: normal;
          color: #000;
          margin-top: 1em;
          margin-bottom: 0.25em;
          padding-bottom: 0.25em;
          border-bottom: 1px solid #a2a9b1;
          line-height: 1.3;
        }
        .wiki-content h1 { font-size: 1.8em; border-bottom: none; }
        .wiki-content h2 { font-size: 1.5em; }
        .wiki-content h3 { font-size: 1.2em; border-bottom: none; }
        .wiki-content h4, 
        .wiki-content h5, 
        .wiki-content h6 { 
          font-size: 1em; 
          border-bottom: none; 
          font-weight: bold;
        }
        .wiki-content p {
          margin: 0.5em 0;
        }
        .wiki-content a[data-wiki-link] {
          text-decoration: none;
        }
        .wiki-content a[data-wiki-link]:hover {
          text-decoration: underline;
        }
        .wiki-content img {
          max-width: 100%;
          height: auto;
        }
        .wiki-content table {
          border-collapse: collapse;
          margin: 1em 0;
        }
        .wiki-content th, 
        .wiki-content td {
          border: 1px solid #a2a9b1;
          padding: 0.2em 0.4em;
          vertical-align: top;
        }
        .wiki-content th {
          background-color: #eaecf0;
          text-align: left;
        }
        .wiki-content ul, 
        .wiki-content ol {
          margin: 0.3em 0 0 1.6em;
          padding: 0;
        }
        .wiki-content li {
          margin-bottom: 0.1em;
        }
        .wiki-content .mw-editsection {
          display: none;
        }
        .wiki-content .infobox {
          border: 1px solid #a2a9b1;
          background-color: #f8f9fa;
          margin: 0.5em 0 0.5em 1em;
          padding: 0.2em;
          float: right;
          clear: right;
          font-size: 88%;
          line-height: 1.5em;
          width: 22em;
        }
        .wiki-content .thumb {
          margin: 0.5em 0 1.3em 1.4em;
          float: right;
          clear: right;
          background-color: #f8f9fa;
          border: 1px solid #c8ccd1;
          padding: 3px;
        }
        .wiki-content .thumbinner {
          padding: 3px;
        }
        .wiki-content .thumbcaption {
          font-size: 94%;
          padding: 3px;
          text-align: left;
        }
        .wiki-content .navbox,
        .wiki-content .vertical-navbox,
        .wiki-content .sistersitebox,
        .wiki-content .metadata {
          display: none;
        }
        .wiki-content .hatnote {
          font-style: italic;
          padding-left: 1.6em;
          margin-bottom: 0.5em;
        }
        .wiki-content .reference {
          font-size: 0.85em;
          vertical-align: super;
        }
        .wiki-content .reflist {
          font-size: 90%;
        }
        .wiki-content blockquote {
          margin: 1em 40px;
          padding: 0;
          font-style: italic;
        }
        .wiki-content .mw-parser-output > :first-child {
          margin-top: 0;
        }
      `}</style>
      <div dangerouslySetInnerHTML={{ __html: processedHtml }} />
    </div>
  );
}
