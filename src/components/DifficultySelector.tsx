'use client';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'INSANE';

interface DifficultySelectorProps {
  value: Difficulty;
  onChange: (value: Difficulty) => void;
}

const difficulties: { value: Difficulty; label: string; hops: string; color: string }[] = [
  { value: 'EASY', label: 'Easy', hops: '1-2 hops', color: '#14866d' },
  { value: 'MEDIUM', label: 'Medium', hops: '2-3 hops', color: '#b36b00' },
  { value: 'HARD', label: 'Hard', hops: '3-4 hops', color: '#c33' },
  { value: 'INSANE', label: 'Insane', hops: '4+ hops', color: '#91154a' },
];

export default function DifficultySelector({ value, onChange }: DifficultySelectorProps) {
  return (
    <div style={{ 
      display: 'flex', 
      gap: '8px',
      flexWrap: 'wrap'
    }}>
      {difficulties.map((diff) => {
        const isSelected = value === diff.value;
        return (
          <button
            key={diff.value}
            onClick={() => onChange(diff.value)}
            style={{
              padding: '10px 18px',
              border: `2px solid ${isSelected ? diff.color : '#a2a9b1'}`,
              borderRadius: '3px',
              background: isSelected ? diff.color : '#fff',
              color: isSelected ? '#fff' : '#000',
              fontFamily: 'sans-serif',
              fontSize: '0.9em',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ fontWeight: 'bold' }}>{diff.label}</div>
            <div style={{ 
              fontSize: '0.85em',
              opacity: isSelected ? 1 : 0.8
            }}>
              {diff.hops}
            </div>
          </button>
        );
      })}
    </div>
  );
}
