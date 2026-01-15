'use client';

export type FeasibilityStatus = 'idle' | 'checking' | 'possible' | 'not_possible' | 'unknown';

interface StatusIndicatorProps {
  status: FeasibilityStatus;
  dStart?: number;
}

function getDifficultyLabel(d: number): string {
  if (d >= 8) return 'Insane';
  if (d >= 6) return 'Hard';
  if (d >= 4) return 'Medium';
  return 'Easy';
}

function getDifficultyColor(d: number): string {
  if (d >= 8) return '#a3174a'; // dark pink/red
  if (d >= 6) return '#cc3333'; // red
  if (d >= 4) return '#ac6600'; // orange
  return '#00af89'; // green
}

export default function StatusIndicator({ status, dStart }: StatusIndicatorProps) {
  if (status === 'idle') {
    return null;
  }

  const getStatusContent = () => {
    switch (status) {
      case 'checking':
        return {
          bg: '#eaf3ff',
          border: '#3366cc',
          icon: '⏳',
          text: 'Checking path feasibility...',
          color: '#3366cc'
        };
      case 'possible':
        return {
          bg: '#d5fdf4',
          border: '#00af89',
          icon: '✓',
          text: dStart 
            ? `Path found! Distance: ${dStart} hops (${getDifficultyLabel(dStart)})`
            : 'Path found!',
          color: dStart ? getDifficultyColor(dStart) : '#00af89'
        };
      case 'not_possible':
        return {
          bg: '#fee7e6',
          border: '#cc3333',
          icon: '✗',
          text: 'No path found within 7 hops. Try different articles.',
          color: '#cc3333'
        };
      case 'unknown':
        return {
          bg: '#fef6e7',
          border: '#fc3',
          icon: '?',
          text: 'Could not determine path. You can still try to play!',
          color: '#ac6600'
        };
      default:
        return null;
    }
  };

  const content = getStatusContent();
  if (!content) return null;

  return (
    <div style={{
      background: content.bg,
      border: `1px solid ${content.border}`,
      padding: '10px 15px',
      fontFamily: 'sans-serif',
      fontSize: '0.9em',
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    }}>
      <span style={{ 
        fontSize: '1.2em',
        color: content.color
      }}>
        {content.icon}
      </span>
      <span style={{ color: '#202122' }}>
        {content.text}
      </span>
    </div>
  );
}
