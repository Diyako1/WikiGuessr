'use client';

import { useState } from 'react';

interface OptimalPathProps {
  currentTitle: string;
  targetTitle: string;
  optimalPath?: string[]; // Pre-computed path from game start
  onLinkClick: (title: string) => void;
  disabled?: boolean;
}

export default function OptimalPath({
  currentTitle,
  targetTitle,
  optimalPath,
  onLinkClick,
  disabled = false,
}: OptimalPathProps) {
  const [revealed, setRevealed] = useState(false);

  // Find where we are in the optimal path
  const currentIndex = optimalPath?.findIndex(t => t === currentTitle) ?? -1;
  
  // Get remaining path from current position
  const remainingPath = currentIndex >= 0 && optimalPath 
    ? optimalPath.slice(currentIndex)
    : optimalPath;

  const handleReveal = () => {
    setRevealed(true);
  };

  if (!optimalPath || optimalPath.length === 0) {
    return (
      <div style={{ 
        background: '#fff', 
        padding: '20px',
        color: '#202122',
        fontFamily: 'sans-serif',
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#000' }}>
          Optimal Path
        </h3>
        <div style={{
          background: '#fef6e7',
          border: '1px solid #fc3',
          borderRadius: '4px',
          padding: '12px',
          color: '#705000',
          fontSize: '14px',
        }}>
          Optimal path was not computed for this game. This can happen with very distant articles.
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      background: '#fff', 
      padding: '20px',
      color: '#202122',
      fontFamily: 'sans-serif',
    }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#000' }}>
        Optimal Path
      </h3>
      
      <p style={{ color: '#54595d', marginBottom: '16px', fontSize: '14px' }}>
        The shortest route from <strong>{optimalPath[0]}</strong> to <strong>{targetTitle}</strong> is <strong>{optimalPath.length - 1} hops</strong>.
        <br />
        <span style={{ color: '#a2a9b1' }}>Warning: Revealing this hint may affect your sense of achievement!</span>
      </p>

      {!revealed && (
        <button
          onClick={handleReveal}
          disabled={disabled}
          style={{
            background: '#3366cc',
            color: '#fff',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          Reveal Optimal Path
        </button>
      )}

      {revealed && (
        <div>
          {/* Full optimal path */}
          <div style={{
            background: '#f8f9fa',
            border: '1px solid #a2a9b1',
            borderRadius: '4px',
            padding: '16px',
            marginBottom: '16px',
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '12px', color: '#202122' }}>
              Full optimal path ({optimalPath.length - 1} {optimalPath.length - 1 === 1 ? 'hop' : 'hops'}):
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
              {optimalPath.map((title, index) => {
                const isFirst = index === 0;
                const isLast = index === optimalPath.length - 1;
                const isCurrent = title === currentTitle;
                const isPast = currentIndex >= 0 && index < currentIndex;
                
                return (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {index > 0 && (
                      <span style={{ color: '#a2a9b1', fontSize: '16px' }}>→</span>
                    )}
                    <span
                      style={{
                        background: isLast ? '#d5fdf4' : isCurrent ? '#eaf3ff' : isPast ? '#f8f9fa' : '#fff',
                        color: isLast ? '#006b5a' : isCurrent ? '#3366cc' : isPast ? '#a2a9b1' : '#0645ad',
                        border: `1px solid ${isLast ? '#00af89' : isCurrent ? '#3366cc' : isPast ? '#c8ccd1' : '#a2a9b1'}`,
                        padding: '4px 10px',
                        borderRadius: '3px',
                        fontSize: '13px',
                        fontWeight: isLast || isCurrent ? 'bold' : 'normal',
                        textDecoration: isPast ? 'line-through' : 'none',
                      }}
                    >
                      {title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Remaining path from current position */}
          {remainingPath && remainingPath.length > 1 && currentIndex > 0 && (
            <div style={{
              background: '#eaf3ff',
              border: '1px solid #3366cc',
              borderRadius: '4px',
              padding: '16px',
              marginBottom: '16px',
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '12px', color: '#3366cc' }}>
                From your current position ({remainingPath.length - 1} {remainingPath.length - 1 === 1 ? 'hop' : 'hops'} remaining):
              </div>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                {remainingPath.map((title, index) => {
                  const isFirst = index === 0;
                  const isLast = index === remainingPath.length - 1;
                  const isNext = index === 1;
                  
                  return (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {index > 0 && (
                        <span style={{ color: '#72777d', fontSize: '16px' }}>→</span>
                      )}
                      <button
                        onClick={() => !isFirst && onLinkClick(title)}
                        disabled={disabled || isFirst}
                        style={{
                          background: isLast ? '#00af89' : isFirst ? '#3366cc' : isNext ? '#fff' : '#f8f9fa',
                          color: isLast || isFirst ? '#fff' : '#0645ad',
                          border: `1px solid ${isLast ? '#00af89' : isFirst ? '#3366cc' : '#0645ad'}`,
                          padding: '6px 12px',
                          borderRadius: '4px',
                          fontSize: '13px',
                          fontWeight: isLast || isFirst || isNext ? 'bold' : 'normal',
                          cursor: disabled || isFirst ? 'default' : 'pointer',
                        }}
                      >
                        {isFirst && '(You are here) '}
                        {title}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ fontSize: '13px', color: '#54595d' }}>
            <strong>Tip:</strong> Click any article in the path to navigate to it (if it's a valid link from your current page).
          </div>
        </div>
      )}

      {!revealed && (
        <div style={{ marginTop: '16px', fontSize: '13px', color: '#72777d' }}>
          The optimal path shows the minimum number of clicks needed to reach the target.
        </div>
      )}
    </div>
  );
}
