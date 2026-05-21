import React from 'react';
import { PALETTE } from '../lib/palette';

interface WaveformProps {
  pattern?: string;
  playing?: boolean;
}

const Waveform = ({ pattern = 'piano', playing = false }: WaveformProps) => {
  const patterns = {
    piano: [0.3, 0.7, 0.4, 0.9, 0.5, 0.8, 0.6, 0.3, 0.7, 0.4, 0.6, 0.3, 0.5, 0.8, 0.4, 0.6, 0.3, 0.5, 0.7, 0.4],
    strings: [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.8, 0.7, 0.6, 0.7, 0.8, 0.9, 0.7, 0.6, 0.5, 0.6, 0.7, 0.5, 0.4, 0.5],
    pads: [0.5, 0.55, 0.6, 0.58, 0.6, 0.62, 0.58, 0.6, 0.55, 0.58, 0.6, 0.62, 0.58, 0.55, 0.6, 0.58, 0.55, 0.5, 0.55, 0.5],
    silence: [0.08, 0.06, 0.1, 0.08, 0.06, 0.08, 0.1, 0.06, 0.08, 0.06, 0.1, 0.08, 0.06, 0.08, 0.1, 0.06, 0.08, 0.06, 0.1, 0.08],
  };
  const bars = patterns[pattern as keyof typeof patterns] || patterns.piano;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 22 }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          width: 2, height: `${h * 100}%`, background: PALETTE.brassDeep, borderRadius: 1,
          opacity: playing ? 1 : 0.6,
          animation: playing ? `wave-${i % 4} 1.4s ease-in-out infinite ${i * 60}ms` : 'none',
        }}/>
      ))}
      <style>{`
        @keyframes wave-0 { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(1.4); } }
        @keyframes wave-1 { 0%,100% { transform: scaleY(0.8); } 50% { transform: scaleY(1.2); } }
        @keyframes wave-2 { 0%,100% { transform: scaleY(1.2); } 50% { transform: scaleY(0.6); } }
        @keyframes wave-3 { 0%,100% { transform: scaleY(0.9); } 50% { transform: scaleY(1.3); } }
      `}</style>
    </div>
  );
};

export default Waveform;
