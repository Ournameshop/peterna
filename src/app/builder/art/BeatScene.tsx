import React from 'react';
import { PALETTE } from '../lib/palette';
import PetSketch from './PetSketch';

interface BeatSceneProps {
  beatIndex: number;
  themeGradient?: string;
  aspect?: string;
  species?: string;
}

const BeatScene = ({ beatIndex, themeGradient, aspect, species }: BeatSceneProps) => {
  const compositions = [
    { petY: 70, petScale: 1.0, accents: 'sun' },
    { petY: 65, petScale: 0.85, accents: 'left' },
    { petY: 75, petScale: 1.2, accents: 'close' },
    { petY: 80, petScale: 0.6, accents: 'wide' },
    { petY: 70, petScale: 1.0, accents: 'particles' },
    { petY: 60, petScale: 0.9, accents: 'horizon' },
    { petY: 75, petScale: 1.1, accents: 'rim' },
    { petY: 78, petScale: 0.8, accents: 'silhouette' },
  ];
  const c = compositions[beatIndex % compositions.length];
  const aspectRatio = aspect === '9:16' ? '9 / 16' : aspect === '16:9' ? '16 / 9' : '1';

  return (
    <div style={{ aspectRatio, background: themeGradient || PALETTE.parchment, position: 'relative', overflow: 'hidden' }}>
      {c.accents === 'sun' && (
        <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.55)', filter: 'blur(4px)' }}/>
      )}
      {c.accents === 'horizon' && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: '55%', height: 1, background: 'rgba(255,255,255,0.4)' }}/>
      )}
      {c.accents === 'particles' && (
        <>{[1,2,3,4,5,6].map(i => (
          <div key={i} style={{ position: 'absolute', top: `${15 + i*9}%`, left: `${20 + (i%3)*25}%`, width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.7)' }}/>
        ))}</>
      )}
      {c.accents === 'rim' && (
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 70% 40%, rgba(255,255,255,0.4), transparent 50%)' }}/>
      )}
      {c.accents === 'left' && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(0,0,0,0.25), transparent 60%)' }}/>
      )}
      <div style={{ position: 'absolute', left: '50%', top: `${c.petY}%`, transform: `translate(-50%, -50%) scale(${c.petScale})` }}>
        <PetSketch size={70} color={c.accents === 'silhouette' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.88)'} species={species}/>
      </div>
      <div style={{ position: 'absolute', top: 8, left: 10, fontSize: 10, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
        Beat {String(beatIndex + 1).padStart(2, '0')}
      </div>
    </div>
  );
};

export default BeatScene;
