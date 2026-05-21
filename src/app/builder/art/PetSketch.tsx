import React from 'react';
import { PALETTE } from '../lib/palette';

interface PetSketchProps {
  size?: number;
  color?: string;
  dim?: boolean;
  species?: string;
}

const PetSketch = ({ size = 120, color = PALETTE.espresso, dim = false, species = 'dog' }: PetSketchProps) => {
  if (species === 'Cat') {
    return (
      <svg width={size} height={size} viewBox="0 0 120 120" style={{ opacity: dim ? 0.35 : 0.85 }}>
        <ellipse cx="60" cy="76" rx="34" ry="30" fill="none" stroke={color} strokeWidth="1.4"/>
        <path d="M 32 56 L 38 32 L 50 50 Z" fill="none" stroke={color} strokeWidth="1.4"/>
        <path d="M 88 56 L 82 32 L 70 50 Z" fill="none" stroke={color} strokeWidth="1.4"/>
        <ellipse cx="50" cy="70" rx="2.5" ry="3.5" fill={color}/>
        <ellipse cx="70" cy="70" rx="2.5" ry="3.5" fill={color}/>
        <path d="M 58 80 L 62 80 L 60 83 Z" fill={color}/>
        <line x1="42" y1="80" x2="32" y2="78" stroke={color} strokeWidth="0.8"/>
        <line x1="42" y1="83" x2="32" y2="84" stroke={color} strokeWidth="0.8"/>
        <line x1="78" y1="80" x2="88" y2="78" stroke={color} strokeWidth="0.8"/>
        <line x1="78" y1="83" x2="88" y2="84" stroke={color} strokeWidth="0.8"/>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" style={{ opacity: dim ? 0.35 : 0.85 }}>
      <ellipse cx="60" cy="78" rx="38" ry="32" fill="none" stroke={color} strokeWidth="1.4"/>
      <path d="M 30 58 Q 28 38 38 38 Q 44 38 44 50" fill="none" stroke={color} strokeWidth="1.4"/>
      <path d="M 90 58 Q 92 38 82 38 Q 76 38 76 50" fill="none" stroke={color} strokeWidth="1.4"/>
      <circle cx="50" cy="70" r="2.5" fill={color}/>
      <circle cx="70" cy="70" r="2.5" fill={color}/>
      <path d="M 56 82 Q 60 86 64 82" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <ellipse cx="60" cy="80" rx="3" ry="2" fill={color} opacity="0.6"/>
    </svg>
  );
};

export default PetSketch;
