'use client';

interface BreadcrumbsProps {
  path: string[];
  startTitle: string;
  targetTitle: string;
}

export default function Breadcrumbs({ path, startTitle, targetTitle }: BreadcrumbsProps) {
  return (
    <div style={{ 
      fontFamily: 'sans-serif',
      fontSize: '0.85em',
      color: '#54595d',
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '4px'
    }}>
      <span style={{ color: '#72777d' }}>Path:</span>
      {path.map((title, index) => {
        const isFirst = index === 0;
        const isLast = index === path.length - 1;
        const isTarget = title === targetTitle;

        return (
          <span key={index} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {index > 0 && <span style={{ color: '#a2a9b1' }}>→</span>}
            <span
              style={{
                color: isTarget ? '#00af89' : isFirst ? '#72777d' : isLast ? '#0645ad' : '#0645ad',
                fontWeight: isLast ? 'bold' : 'normal',
                background: isTarget ? '#d5fdf4' : 'transparent',
                padding: isTarget ? '2px 6px' : '0',
                borderRadius: '2px'
              }}
            >
              {title}
            </span>
          </span>
        );
      })}
    </div>
  );
}
