'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Timer from '@/components/Timer';
import ProgressBar, { DeltaType } from '@/components/ProgressBar';
import Breadcrumbs from '@/components/Breadcrumbs';
import WikiArticle from '@/components/WikiArticle';
import LinkList from '@/components/LinkList';
import OptimalPath from '@/components/OptimalPath';

interface PageSummary {
  title: string;
  displayTitle: string;
  extract: string;
  description?: string;
}

interface GameState {
  id: string;
  startTitle: string;
  targetTitle: string;
  currentTitle: string;
  dStart: number;
  dPrev: number | null;
  clicks: number;
  pathTitles: string[];
  startedAt: number;
  status: 'active' | 'won' | 'abandoned';
  progressFill: number;
  summary: PageSummary | null;
  links: string[];
  optimalPath?: string[]; // Pre-computed optimal path from game start
}

export default function PlayPage() {
  const router = useRouter();
  const params = useParams();
  const gameId = params.gameId as string;

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delta, setDelta] = useState<DeltaType>('SAME');
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [viewMode, setViewMode] = useState<'article' | 'links' | 'hint'>('article');
  
  const hasWonRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentTitleRef = useRef<string>('');

  // Fetch page HTML content with abort support
  const fetchPageContent = useCallback(async (title: string, signal?: AbortSignal) => {
    try {
      console.log(`[PlayPage] Fetching HTML for: ${title}`);
      const response = await fetch(`/api/wiki/page?title=${encodeURIComponent(title)}`, { signal });
      
      if (signal?.aborted) return;
      
      if (response.ok) {
        const data = await response.json();
        // Only update if this is still the current title (race condition guard)
        if (currentTitleRef.current === title) {
          setHtmlContent(data.htmlContent || '');
          console.log(`[PlayPage] HTML loaded for: ${title} (${(data.htmlContent || '').length} chars)`);
        } else {
          console.log(`[PlayPage] Ignoring stale HTML response for: ${title} (current: ${currentTitleRef.current})`);
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        console.log(`[PlayPage] Fetch aborted for: ${title}`);
        return;
      }
      console.error('Failed to fetch page content:', err);
    }
  }, []);

  // Fetch initial game state
  useEffect(() => {
    const fetchGame = async () => {
      try {
        const response = await fetch(`/api/game/${gameId}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('Game not found or expired');
          } else {
            throw new Error('Failed to fetch game');
          }
          return;
        }

        const data = await response.json();
        setGameState(data);
        currentTitleRef.current = data.currentTitle;
        
        // Fetch HTML content
        const controller = new AbortController();
        abortControllerRef.current = controller;
        await fetchPageContent(data.currentTitle, controller.signal);
        
        if (data.status === 'won') {
          hasWonRef.current = true;
        }
      } catch (err) {
        console.error('Fetch game error:', err);
        setError('Failed to load game');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGame();
    
    return () => {
      // Cleanup: abort any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [gameId, fetchPageContent]);

  // Handle winning
  useEffect(() => {
    if (gameState?.status === 'won' && !hasWonRef.current) {
      hasWonRef.current = true;
      
      const completeGame = async () => {
        try {
          const response = await fetch('/api/game/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameId }),
          });

          if (response.ok) {
            setTimeout(() => {
              router.push(`/results/${gameId}`);
            }, 1500);
          }
        } catch (err) {
          console.error('Complete game error:', err);
        }
      };

      completeGame();
    }
  }, [gameState?.status, gameId, router]);

  const handleLinkClick = useCallback(async (nextTitle: string) => {
    if (!gameState || isMoving || gameState.status !== 'active') {
      console.log(`[PlayPage] Click ignored: moving=${isMoving}, status=${gameState?.status}`);
      return;
    }

    console.log(`[PlayPage] Link clicked: "${nextTitle}"`);
    
    // Abort any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setIsMoving(true);
    setError(null);

    // Create new abort controller for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/game/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, nextTitle }),
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to make move');
      }

      console.log(`[PlayPage] Move successful: ${nextTitle}, links: ${data.links?.length || 0}`);
      
      // Update current title ref BEFORE setting state
      currentTitleRef.current = data.currentTitle;
      
      // Update game state immediately
      setGameState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          currentTitle: data.currentTitle,
          clicks: data.clicks,
          pathTitles: data.pathTitles,
          dPrev: data.d_now,
          progressFill: data.progressFill,
          status: data.status,
          summary: data.summary,
          links: data.links,
        };
      });

      // Set HTML content from response if available
      if (data.htmlContent) {
        setHtmlContent(data.htmlContent);
      } else {
        // Fetch HTML content separately
        await fetchPageContent(data.currentTitle, controller.signal);
      }

      setDelta(data.delta);
      
      // Switch back to article view after navigation
      setViewMode('article');
      
      setTimeout(() => setDelta('SAME'), 1000);

      if (data.status === 'won') {
        console.log(`[PlayPage] Game won!`);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        console.log(`[PlayPage] Move request aborted`);
        return;
      }
      console.error('Move error:', err);
      setError(err instanceof Error ? err.message : 'Failed to make move');
    } finally {
      setIsMoving(false);
    }
  }, [gameState, isMoving, gameId, fetchPageContent]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f6f6f6' }}>
        <div style={{ textAlign: 'center', fontFamily: 'sans-serif' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '3px solid #a2a9b1',
            borderTopColor: '#3366cc',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1em'
          }} />
          <style jsx>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
          <p style={{ color: '#54595d' }}>Loading game...</p>
        </div>
      </div>
    );
  }

  if (error && !gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f6f6f6' }}>
        <div style={{ 
          background: '#fff', 
          border: '1px solid #a2a9b1',
          padding: '40px',
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <h1 style={{ 
            fontFamily: "'Linux Libertine', 'Georgia', serif",
            fontSize: '1.5em',
            marginBottom: '0.5em',
            borderBottom: 'none'
          }}>
            Game Not Found
          </h1>
          <p style={{ 
            fontFamily: 'sans-serif',
            fontSize: '0.9em',
            color: '#54595d',
            marginBottom: '1.5em'
          }}>
            {error}
          </p>
          <button
            onClick={() => router.push('/')}
            className="wiki-button wiki-button-primary"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!gameState) return null;

  const isWon = gameState.status === 'won';

  return (
    <div className="min-h-screen" style={{ background: '#f6f6f6' }}>
      {/* Win overlay */}
      {isWon && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            background: '#fff',
            border: '1px solid #00af89',
            padding: '40px 60px',
            textAlign: 'center'
          }}>
            <h1 style={{ 
              fontFamily: "'Linux Libertine', 'Georgia', serif",
              fontSize: '2em',
              color: '#00af89',
              marginBottom: '0.25em',
              borderBottom: 'none'
            }}>
              You Won!
            </h1>
            <p style={{ 
              fontFamily: 'sans-serif',
              color: '#54595d'
            }}>
              Redirecting to results...
            </p>
          </div>
        </div>
      )}

      {/* Wikipedia-style header */}
      <header style={{ 
        background: '#fff', 
        borderBottom: '1px solid #a2a9b1',
        padding: '10px 0',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div className="container mx-auto px-4 max-w-5xl">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            {/* Logo and title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Wikipedia-logo-v2.svg/103px-Wikipedia-logo-v2.svg.png" 
                  alt="Wikipedia" 
                  style={{ height: '40px' }}
                />
                <span style={{ 
                  fontFamily: "'Linux Libertine', 'Georgia', serif",
                  fontSize: '1.2em',
                  color: '#000'
                }}>
                  WikiGuesser
                </span>
              </a>
            </div>

            {/* Game stats */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '20px',
              fontFamily: 'sans-serif',
              fontSize: '0.9em'
            }}>
              <Timer startedAt={gameState.startedAt} isRunning={!isWon} />
              <div>
                <strong>{gameState.clicks}</strong> clicks
              </div>
              <div style={{ 
                background: '#d5fdf4',
                border: '1px solid #00af89',
                padding: '4px 12px',
                borderRadius: '3px',
                color: '#006b5a'
              }}>
                Target: <strong>{gameState.targetTitle}</strong>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: '10px' }}>
            <ProgressBar
              progressFill={gameState.progressFill}
              dNow={gameState.dPrev}
              delta={delta}
              dStart={gameState.dStart}
            />
          </div>
        </div>
      </header>

      {/* Breadcrumbs */}
      <div style={{ 
        background: '#f8f9fa', 
        borderBottom: '1px solid #c8ccd1',
        padding: '8px 0'
      }}>
        <div className="container mx-auto px-4 max-w-5xl">
          <Breadcrumbs
            path={gameState.pathTitles}
            startTitle={gameState.startTitle}
            targetTitle={gameState.targetTitle}
          />
        </div>
      </div>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Article header */}
        <div style={{ 
          background: '#fff', 
          border: '1px solid #a2a9b1',
          borderBottom: 'none',
          padding: '20px 20px 0'
        }}>
          <h1 style={{ 
            fontFamily: "'Linux Libertine', 'Georgia', serif",
            fontSize: '1.8em',
            fontWeight: 'normal',
            margin: 0,
            paddingBottom: '0',
            borderBottom: 'none'
          }}>
            {gameState.summary?.displayTitle || gameState.currentTitle}
          </h1>
          
          {gameState.summary?.description && (
            <p style={{ 
              fontFamily: 'sans-serif',
              fontSize: '0.85em',
              color: '#54595d',
              fontStyle: 'italic',
              margin: '5px 0 15px'
            }}>
              {gameState.summary.description}
            </p>
          )}

          {/* View mode tabs */}
          <div style={{ 
            display: 'flex', 
            gap: '0',
            borderBottom: '1px solid #a2a9b1',
            marginTop: '15px'
          }}>
            {[
              { id: 'article', label: 'Article' },
              { id: 'links', label: `Links (${gameState.links.length})` },
              { id: 'hint', label: 'Optimal Path' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id as typeof viewMode)}
                style={{
                  fontFamily: 'sans-serif',
                  fontSize: '0.9em',
                  padding: '8px 16px',
                  border: 'none',
                  borderBottom: viewMode === tab.id ? '2px solid #3366cc' : '2px solid transparent',
                  background: viewMode === tab.id ? '#fff' : '#f8f9fa',
                  color: viewMode === tab.id ? '#3366cc' : '#54595d',
                  cursor: 'pointer',
                  marginBottom: '-1px'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="wiki-notice wiki-notice-error">
            {error}
          </div>
        )}

        {/* Content based on view mode */}
        <div style={{ 
          background: '#fff', 
          border: '1px solid #a2a9b1',
          borderTop: 'none',
          padding: '20px',
          minHeight: '400px'
        }}>
          {isMoving ? (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              padding: '60px',
              fontFamily: 'sans-serif'
            }}>
              <div style={{ 
                width: '30px', 
                height: '30px', 
                border: '3px solid #a2a9b1',
                borderTopColor: '#3366cc',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginRight: '12px'
              }} />
              <style jsx>{`
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
              <span style={{ color: '#54595d' }}>Loading article...</span>
            </div>
          ) : viewMode === 'article' ? (
            <WikiArticle
              htmlContent={htmlContent}
              links={gameState.links}
              onLinkClick={handleLinkClick}
              targetTitle={gameState.targetTitle}
              disabled={isMoving || isWon}
            />
          ) : viewMode === 'links' ? (
            <LinkList
              links={gameState.links}
              onLinkClick={handleLinkClick}
              disabled={isMoving || isWon}
              targetTitle={gameState.targetTitle}
            />
          ) : (
            <OptimalPath
              currentTitle={gameState.currentTitle}
              targetTitle={gameState.targetTitle}
              optimalPath={gameState.optimalPath}
              onLinkClick={handleLinkClick}
              disabled={isMoving || isWon}
            />
          )}
        </div>

        {/* Wikipedia link */}
        <div style={{ 
          textAlign: 'center', 
          marginTop: '15px',
          fontFamily: 'sans-serif',
          fontSize: '0.85em'
        }}>
          <a
            href={`https://en.wikipedia.org/wiki/${encodeURIComponent(gameState.currentTitle.replace(/ /g, '_'))}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#3366cc' }}
          >
            View original article on Wikipedia ↗
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ 
        borderTop: '1px solid #a2a9b1',
        padding: '15px 0',
        marginTop: '40px',
        background: '#f8f9fa'
      }}>
        <div className="container mx-auto px-4 max-w-4xl" style={{ 
          textAlign: 'center',
          fontFamily: 'sans-serif',
          fontSize: '0.8em',
          color: '#72777d'
        }}>
          WikiGuesser uses the <a href="https://www.mediawiki.org/wiki/API:Main_page" target="_blank" rel="noopener noreferrer">Wikipedia API</a>. 
          Content is available under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>.
        </div>
      </footer>
    </div>
  );
}
