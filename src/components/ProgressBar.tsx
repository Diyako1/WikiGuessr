'use client';

export type DeltaType = 'CLOSER' | 'FARTHER' | 'SAME' | 'UNKNOWN';

interface ProgressBarProps {
  progressFill: number;
  dNow: number | null;
  delta: DeltaType;
  dStart: number;
}

export default function ProgressBar({ progressFill, dNow, delta, dStart }: ProgressBarProps) {
  // Color based on delta (direction of movement)
  const getBarColor = () => {
    switch (delta) {
      case 'CLOSER':
        return '#00af89'; // Green - getting closer
      case 'FARTHER':
        return '#cc3333'; // Red - getting farther
      case 'SAME':
        return '#ac6600'; // Orange - same distance
      default:
        return '#72777d'; // Gray - unknown
    }
  };

  const getDeltaIndicator = () => {
    switch (delta) {
      case 'CLOSER':
        return { symbol: '↑', color: '#00af89', text: 'Getting closer' };
      case 'FARTHER':
        return { symbol: '↓', color: '#cc3333', text: 'Getting farther' };
      case 'SAME':
        return { symbol: '→', color: '#ac6600', text: 'Same distance' };
      default:
        return { symbol: '?', color: '#72777d', text: 'Unknown' };
    }
  };

  const deltaInfo = getDeltaIndicator();
  const barColor = getBarColor();
  
  // Calculate progress percentage (how close to target)
  // progressFill is 0 at start, 1 at target
  const progressPercent = Math.max(0, Math.min(100, Math.round(progressFill * 100)));

  return (
    <div style={{ fontFamily: 'sans-serif', fontSize: '0.85em' }}>
      {/* Progress bar */}
      <div style={{
        background: '#eaecf0',
        borderRadius: '4px',
        height: '12px',
        overflow: 'hidden',
        marginBottom: '6px',
        border: '1px solid #c8ccd1'
      }}>
        <div
          style={{
            width: `${progressPercent}%`,
            height: '100%',
            background: barColor,
            transition: 'width 0.3s ease, background 0.3s ease',
            borderRadius: '3px'
          }}
        />
      </div>

      {/* Status line */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        color: '#202122'
      }}>
        <span>
          {dNow !== null ? (
            <>
              <strong style={{ color: deltaInfo.color }}>{deltaInfo.symbol} {deltaInfo.text}</strong>
              {' — '}
              {dNow === 0 ? 'Target reached!' : `${dNow} hop${dNow !== 1 ? 's' : ''} away`}
            </>
          ) : (
            <span style={{ color: '#72777d' }}>Distance unknown</span>
          )}
        </span>
        <span style={{ color: '#54595d' }}>
          Started {dStart} hops away
        </span>
      </div>
    </div>
  );
}
