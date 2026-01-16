'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AutocompleteInput from '@/components/AutocompleteInput';
import StatusIndicator, { FeasibilityStatus } from '@/components/StatusIndicator';
import DifficultySelector, { Difficulty } from '@/components/DifficultySelector';

export default function SetupPage() {
  const router = useRouter();
  
  // Input states
  const [startValue, setStartValue] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [startSelected, setStartSelected] = useState('');
  const [targetSelected, setTargetSelected] = useState('');
  
  // Feasibility state
  const [feasibilityStatus, setFeasibilityStatus] = useState<FeasibilityStatus>('idle');
  const [dStart, setDStart] = useState<number | undefined>();
  
  // Generator state
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  
  // Starting game state
  const [isStarting, setIsStarting] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check feasibility when both are selected
  useEffect(() => {
    if (!startSelected || !targetSelected) {
      setFeasibilityStatus('idle');
      setDStart(undefined);
      return;
    }

    // Debounce the feasibility check
    const timer = setTimeout(async () => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setFeasibilityStatus('checking');
      setGenerateError(null);

      try {
        const response = await fetch('/api/solve/feasible', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startTitle: startSelected,
            targetTitle: targetSelected,
          }),
          signal: abortControllerRef.current.signal,
        });

        const data = await response.json();

        if (data.status === 'POSSIBLE') {
          setFeasibilityStatus('possible');
          setDStart(data.dStart);
        } else if (data.status === 'NOT_POSSIBLE') {
          setFeasibilityStatus('not_possible');
          setDStart(undefined);
        } else {
          setFeasibilityStatus('unknown');
          setDStart(undefined);
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Feasibility check error:', error);
          setFeasibilityStatus('idle');
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [startSelected, targetSelected]);

  const handleStartSelect = useCallback((title: string) => {
    setStartSelected(title);
  }, []);

  const handleTargetSelect = useCallback((title: string) => {
    setTargetSelected(title);
  }, []);

  const handleGenerate = async (mode: 'BOTH' | 'START_ONLY' | 'TARGET_ONLY') => {
    setIsGenerating(true);
    setGenerateError(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          startTitle: mode === 'TARGET_ONLY' ? startSelected : undefined,
          targetTitle: mode === 'START_ONLY' ? targetSelected : undefined,
          difficulty,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setGenerateError(data.error || 'Failed to generate');
        return;
      }

      // Update inputs with generated values
      if (mode === 'BOTH' || mode === 'START_ONLY') {
        setStartValue(data.startTitle);
        setStartSelected(data.startTitle);
      }
      if (mode === 'BOTH' || mode === 'TARGET_ONLY') {
        setTargetValue(data.targetTitle);
        setTargetSelected(data.targetTitle);
      }

      // Set feasibility directly since generator returns only feasible pairs
      setFeasibilityStatus('possible');
      setDStart(data.dStart);
    } catch (error) {
      console.error('Generate error:', error);
      setGenerateError('Failed to generate. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBegin = async () => {
    if (feasibilityStatus !== 'possible' || !startSelected || !targetSelected) {
      return;
    }

    setIsStarting(true);

    try {
      const response = await fetch('/api/game/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTitle: startSelected,
          targetTitle: targetSelected,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start game');
      }

      router.push(`/play/${data.gameId}`);
    } catch (error) {
      console.error('Start game error:', error);
      setGenerateError('Failed to start game. Please try again.');
      setIsStarting(false);
    }
  };

  const canBegin = feasibilityStatus === 'possible' && !isStarting;

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
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Wikipedia-logo-v2.svg/103px-Wikipedia-logo-v2.svg.png" 
              alt="Wikipedia" 
              style={{ height: '50px' }}
            />
            <div>
              <h1 style={{ 
                fontSize: '1.5em', 
                fontFamily: "'Linux Libertine', 'Georgia', serif",
                fontWeight: 'normal',
                margin: 0,
                borderBottom: 'none',
                color: '#000'
              }}>
                WikiGuessr
              </h1>
              <p style={{ 
                fontSize: '0.85em', 
                color: '#54595d',
                margin: 0,
                fontFamily: 'sans-serif'
              }}>
                The Wikipedia Navigation Game
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Main content box */}
        <div style={{ 
          background: '#fff', 
          border: '1px solid #a2a9b1',
          padding: '20px 30px',
          marginBottom: '20px'
        }}>
          <h2 style={{ 
            fontSize: '1.5em',
            borderBottom: '1px solid #a2a9b1',
            paddingBottom: '0.25em',
            marginTop: 0,
            marginBottom: '1em',
            fontFamily: "'Linux Libertine', 'Georgia', serif",
            fontWeight: 'normal',
            color: '#000'
          }}>
            New Game Setup
          </h2>

          <p style={{ 
            fontFamily: 'sans-serif', 
            fontSize: '0.95em',
            color: '#000',
            marginBottom: '1.5em',
            lineHeight: '1.6'
          }}>
            Navigate from the <strong>start article</strong> to the <strong>target article</strong> by clicking links within Wikipedia pages. 
            Choose your articles below or generate a random pair.
          </p>

          {/* Inputs */}
          <div style={{ marginBottom: '1.5em' }}>
            <AutocompleteInput
              label="Start Article"
              value={startValue}
              onChange={setStartValue}
              onSelect={handleStartSelect}
              isSelected={!!startSelected}
              placeholder="Type to search Wikipedia..."
              disabled={isGenerating || isStarting}
            />
          </div>

          <div style={{ marginBottom: '1.5em' }}>
            <AutocompleteInput
              label="Target Article"
              value={targetValue}
              onChange={setTargetValue}
              onSelect={handleTargetSelect}
              isSelected={!!targetSelected}
              placeholder="Type to search Wikipedia..."
              disabled={isGenerating || isStarting}
            />
          </div>

          {/* Status Indicator */}
          <StatusIndicator status={feasibilityStatus} dStart={dStart} />

          {/* Divider */}
          <div style={{ 
            borderTop: '1px solid #a2a9b1', 
            margin: '1.5em 0',
            position: 'relative'
          }}>
            <span style={{
              position: 'absolute',
              top: '-0.7em',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#fff',
              padding: '0 1em',
              color: '#54595d',
              fontSize: '0.9em',
              fontFamily: 'sans-serif'
            }}>
              or generate random articles
            </span>
          </div>

          {/* Difficulty Selector */}
          <div style={{ marginBottom: '1em', marginTop: '1.5em' }}>
            <label style={{ 
              display: 'block',
              fontFamily: 'sans-serif',
              fontSize: '0.95em',
              fontWeight: 'bold',
              marginBottom: '0.5em',
              color: '#000'
            }}>
              Difficulty
            </label>
            <DifficultySelector value={difficulty} onChange={setDifficulty} />
          </div>

          {/* Generator Buttons */}
          <div style={{ 
            display: 'flex', 
            gap: '10px', 
            flexWrap: 'wrap',
            marginBottom: '1.5em'
          }}>
            <button
              onClick={() => handleGenerate('BOTH')}
              disabled={isGenerating || isStarting}
              style={{ 
                flex: '1', 
                minWidth: '150px',
                padding: '10px 16px',
                background: isGenerating || isStarting ? '#c8ccd1' : '#3366cc',
                border: '1px solid #3366cc',
                borderRadius: '3px',
                color: '#fff',
                fontFamily: 'sans-serif',
                fontSize: '0.9em',
                fontWeight: 'bold',
                cursor: isGenerating || isStarting ? 'not-allowed' : 'pointer'
              }}
            >
              {isGenerating ? 'Generating...' : 'Generate Both'}
            </button>

            <button
              onClick={() => handleGenerate('START_ONLY')}
              disabled={isGenerating || isStarting || !targetSelected}
              style={{ 
                flex: '1', 
                minWidth: '120px',
                padding: '10px 16px',
                background: (isGenerating || isStarting || !targetSelected) ? '#eaecf0' : '#f8f9fa',
                border: '1px solid #a2a9b1',
                borderRadius: '3px',
                color: (isGenerating || isStarting || !targetSelected) ? '#72777d' : '#202122',
                fontFamily: 'sans-serif',
                fontSize: '0.9em',
                cursor: (isGenerating || isStarting || !targetSelected) ? 'not-allowed' : 'pointer'
              }}
            >
              Generate Start
            </button>

            <button
              onClick={() => handleGenerate('TARGET_ONLY')}
              disabled={isGenerating || isStarting || !startSelected}
              style={{ 
                flex: '1', 
                minWidth: '120px',
                padding: '10px 16px',
                background: (isGenerating || isStarting || !startSelected) ? '#eaecf0' : '#f8f9fa',
                border: '1px solid #a2a9b1',
                borderRadius: '3px',
                color: (isGenerating || isStarting || !startSelected) ? '#72777d' : '#202122',
                fontFamily: 'sans-serif',
                fontSize: '0.9em',
                cursor: (isGenerating || isStarting || !startSelected) ? 'not-allowed' : 'pointer'
              }}
            >
              Generate Target
            </button>
          </div>

          {/* Error message */}
          {generateError && (
            <div className="wiki-notice wiki-notice-error" style={{ marginBottom: '1em' }}>
              {generateError}
            </div>
          )}

          {/* Begin Button */}
          <button
            onClick={handleBegin}
            disabled={!canBegin}
            className="wiki-button"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '1.1em',
              fontWeight: 'bold',
              background: canBegin ? '#00af89' : '#c8ccd1',
              borderColor: canBegin ? '#00af89' : '#a2a9b1',
              color: canBegin ? '#fff' : '#72777d',
              cursor: canBegin ? 'pointer' : 'not-allowed'
            }}
          >
            {isStarting ? 'Starting Game...' : 'Begin Game'}
          </button>
        </div>

        {/* How to play box */}
        <div style={{ 
          background: '#f8f9fa', 
          border: '1px solid #a2a9b1',
          padding: '15px 20px'
        }}>
          <h3 style={{ 
            fontSize: '1.1em',
            marginTop: 0,
            marginBottom: '0.5em',
            fontFamily: "'Linux Libertine', 'Georgia', serif",
            fontWeight: 'normal',
            borderBottom: 'none',
            color: '#000'
          }}>
            How to play
          </h3>
          <ul style={{ 
            fontFamily: 'sans-serif', 
            fontSize: '0.95em',
            color: '#000',
            margin: 0,
            paddingLeft: '1.5em',
            lineHeight: '1.8'
          }}>
            <li>Start at the <strong>start article</strong> and try to reach the <strong>target article</strong></li>
            <li>You can only navigate by clicking blue links within each article</li>
            <li>The progress bar shows how close you are — green means you&apos;re getting warmer!</li>
            <li>Try to reach the target in as few clicks as possible</li>
          </ul>
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
          fontSize: '0.85em',
          color: '#54595d'
        }}>
          WikiGuessr uses the <a href="https://www.mediawiki.org/wiki/API:Main_page" target="_blank" rel="noopener noreferrer">Wikipedia API</a>. 
          Content is available under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>.
        </div>
      </footer>
    </div>
  );
}
