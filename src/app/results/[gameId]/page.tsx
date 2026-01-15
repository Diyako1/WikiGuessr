'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface RunResult {
  runId: string;
  startTitle: string;
  targetTitle: string;
  timeMs: number;
  clicks: number;
  dStart: number;
  pathTitles: string[];
  won: boolean;
  score: number;
}

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams();
  const gameId = params.gameId as string;

  const [result, setResult] = useState<RunResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        // First try to complete the game (in case it wasn't completed)
        const completeResponse = await fetch('/api/game/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId }),
        });

        if (completeResponse.ok) {
          const data = await completeResponse.json();
          setResult(data);
        } else {
          // Game might already be completed or doesn't exist
          setError('Game not found or already completed');
        }
      } catch (err) {
        console.error('Fetch result error:', err);
        setError('Failed to load results');
      } finally {
        setIsLoading(false);
      }
    };

    fetchResult();
  }, [gameId]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${Math.floor(milliseconds / 100)}`;
  };

  const getDifficultyInfo = (dStart: number) => {
    if (dStart >= 8) return { label: 'Insane', color: '#a3174a' };
    if (dStart >= 6) return { label: 'Hard', color: '#cc3333' };
    if (dStart >= 4) return { label: 'Medium', color: '#ac6600' };
    return { label: 'Easy', color: '#00af89' };
  };

  const handleCopy = () => {
    if (!result) return;
    const text = `I navigated from "${result.startTitle}" to "${result.targetTitle}" in ${result.clicks} clicks and ${formatTime(result.timeMs)}! Score: ${result.score} #WikiGuesser`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
          <p style={{ color: '#54595d' }}>Loading results...</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
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
            Results Not Found
          </h1>
          <p style={{ 
            fontFamily: 'sans-serif',
            fontSize: '0.9em',
            color: '#54595d',
            marginBottom: '1.5em'
          }}>
            {error || 'Could not load game results'}
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

  const difficulty = getDifficultyInfo(result.dStart);

  return (
    <div className="min-h-screen" style={{ background: '#f6f6f6' }}>
      {/* Wikipedia-style header */}
      <header style={{ 
        background: '#fff', 
        borderBottom: '1px solid #a2a9b1',
        padding: '10px 0'
      }}>
        <div className="container mx-auto px-4 max-w-4xl">
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
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Result header */}
        <div style={{ 
          background: result.won ? '#d5fdf4' : '#f8f9fa', 
          border: `1px solid ${result.won ? '#00af89' : '#a2a9b1'}`,
          padding: '30px',
          textAlign: 'center',
          marginBottom: '20px'
        }}>
          <h1 style={{ 
            fontFamily: "'Linux Libertine', 'Georgia', serif",
            fontSize: '2em',
            fontWeight: 'normal',
            margin: 0,
            borderBottom: 'none',
            color: result.won ? '#006b5a' : '#202122'
          }}>
            {result.won ? 'Victory!' : 'Game Over'}
          </h1>
          
          {result.won && (
            <div style={{ 
              marginTop: '15px',
              fontSize: '2.5em',
              fontWeight: 'bold',
              color: '#ac6600'
            }}>
              {result.score.toLocaleString()} points
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ 
          background: '#fff', 
          border: '1px solid #a2a9b1',
          padding: '20px 30px',
          marginBottom: '20px'
        }}>
          <h2 style={{ 
            fontSize: '1.3em',
            borderBottom: '1px solid #a2a9b1',
            paddingBottom: '0.25em',
            marginTop: 0,
            marginBottom: '1em',
            fontFamily: "'Linux Libertine', 'Georgia', serif",
            fontWeight: 'normal'
          }}>
            Game Statistics
          </h2>

          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontFamily: 'sans-serif',
            fontSize: '0.95em'
          }}>
            <tbody>
              <tr>
                <td style={{ padding: '8px 0', borderBottom: '1px solid #eaecf0', color: '#54595d' }}>Time</td>
                <td style={{ padding: '8px 0', borderBottom: '1px solid #eaecf0', fontWeight: 'bold', textAlign: 'right' }}>
                  {formatTime(result.timeMs)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0', borderBottom: '1px solid #eaecf0', color: '#54595d' }}>Clicks</td>
                <td style={{ padding: '8px 0', borderBottom: '1px solid #eaecf0', fontWeight: 'bold', textAlign: 'right' }}>
                  {result.clicks}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0', borderBottom: '1px solid #eaecf0', color: '#54595d' }}>Optimal Path</td>
                <td style={{ padding: '8px 0', borderBottom: '1px solid #eaecf0', fontWeight: 'bold', textAlign: 'right' }}>
                  {result.dStart} hops
                </td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0', borderBottom: '1px solid #eaecf0', color: '#54595d' }}>Difficulty</td>
                <td style={{ padding: '8px 0', borderBottom: '1px solid #eaecf0', fontWeight: 'bold', textAlign: 'right', color: difficulty.color }}>
                  {difficulty.label}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0', color: '#54595d' }}>Route</td>
                <td style={{ padding: '8px 0', textAlign: 'right' }}>
                  <span style={{ color: '#0645ad' }}>{result.startTitle}</span>
                  {' → '}
                  <span style={{ color: '#00af89', fontWeight: 'bold' }}>{result.targetTitle}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Path taken */}
        <div style={{ 
          background: '#fff', 
          border: '1px solid #a2a9b1',
          padding: '20px 30px',
          marginBottom: '20px'
        }}>
          <h2 style={{ 
            fontSize: '1.3em',
            borderBottom: '1px solid #a2a9b1',
            paddingBottom: '0.25em',
            marginTop: 0,
            marginBottom: '1em',
            fontFamily: "'Linux Libertine', 'Georgia', serif",
            fontWeight: 'normal'
          }}>
            Your Path
          </h2>

          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'sans-serif',
            fontSize: '0.9em'
          }}>
            {result.pathTitles.map((title, index) => {
              const isStart = index === 0;
              const isEnd = index === result.pathTitles.length - 1;
              
              return (
                <span key={`${title}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {index > 0 && <span style={{ color: '#a2a9b1' }}>→</span>}
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '3px',
                      background: isStart ? '#eaf3ff' : isEnd ? '#d5fdf4' : '#f8f9fa',
                      border: `1px solid ${isStart ? '#3366cc' : isEnd ? '#00af89' : '#c8ccd1'}`,
                      color: isStart ? '#3366cc' : isEnd ? '#006b5a' : '#202122',
                      fontWeight: isStart || isEnd ? 'bold' : 'normal'
                    }}
                  >
                    {title}
                  </span>
                </span>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{ 
          display: 'flex', 
          gap: '15px',
          flexWrap: 'wrap'
        }}>
          <Link
            href="/"
            className="wiki-button wiki-button-primary"
            style={{ 
              flex: '1',
              minWidth: '150px',
              textAlign: 'center',
              padding: '12px 20px',
              fontSize: '1em',
              textDecoration: 'none'
            }}
          >
            Play Again
          </Link>
          
          <button
            onClick={handleCopy}
            className="wiki-button"
            style={{ 
              flex: '1',
              minWidth: '150px',
              padding: '12px 20px',
              fontSize: '1em'
            }}
          >
            {copied ? 'Copied!' : 'Copy Result'}
          </button>
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
