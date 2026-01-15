'use client';

import { useState, useEffect } from 'react';

interface TimerProps {
  startedAt: number;
  isRunning: boolean;
}

export default function Timer({ startedAt, isRunning }: TimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setElapsed(Date.now() - startedAt);
    }, 100);

    return () => clearInterval(interval);
  }, [startedAt, isRunning]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);

    return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`;
  };

  return (
    <div style={{ 
      fontFamily: 'monospace',
      fontSize: '1.1em',
      fontWeight: 'bold',
      color: '#202122'
    }}>
      {formatTime(elapsed)}
    </div>
  );
}
