'use client';

import { useState, useMemo } from 'react';

interface LinkListProps {
  links: string[];
  onLinkClick: (title: string) => void;
  disabled?: boolean;
  targetTitle?: string;
}

export default function LinkList({ links, onLinkClick, disabled = false, targetTitle }: LinkListProps) {
  const [search, setSearch] = useState('');

  const filteredLinks = useMemo(() => {
    if (!search) return links;
    const searchLower = search.toLowerCase();
    return links.filter(link => link.toLowerCase().includes(searchLower));
  }, [links, search]);

  // Sort to put target at top if present
  const sortedLinks = useMemo(() => {
    if (!targetTitle) return filteredLinks;
    return [...filteredLinks].sort((a, b) => {
      if (a === targetTitle) return -1;
      if (b === targetTitle) return 1;
      return 0;
    });
  }, [filteredLinks, targetTitle]);

  return (
    <div>
      {/* Search input */}
      <div style={{ marginBottom: '15px' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter links..."
          className="wiki-input"
          style={{ width: '100%', padding: '8px 12px' }}
        />
      </div>

      {/* Link count */}
      <div style={{ 
        marginBottom: '10px',
        fontFamily: 'sans-serif',
        fontSize: '0.85em',
        color: '#54595d'
      }}>
        Showing {sortedLinks.length} of {links.length} links
      </div>

      {/* Links grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '8px'
      }}>
        {sortedLinks.map((link) => {
          const isTarget = link === targetTitle;
          return (
            <button
              key={link}
              onClick={() => onLinkClick(link)}
              disabled={disabled}
              style={{
                padding: '8px 12px',
                textAlign: 'left',
                border: `1px solid ${isTarget ? '#00af89' : '#c8ccd1'}`,
                borderRadius: '3px',
                background: isTarget ? '#d5fdf4' : '#fff',
                color: isTarget ? '#006b5a' : '#0645ad',
                fontFamily: 'sans-serif',
                fontSize: '0.9em',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {link}
            </button>
          );
        })}
      </div>

      {sortedLinks.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: '#72777d',
          fontFamily: 'sans-serif'
        }}>
          No links match your search.
        </div>
      )}
    </div>
  );
}
