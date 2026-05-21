import React from 'react';
import { PALETTE } from '../lib/palette';

interface FormatThumbProps {
  formatId: string;
  width?: number | string;
  height?: number | string;
}

const FormatThumb = ({ formatId, width = '100%', height = 56 }: FormatThumbProps) => {
  const W = 240, H = 60;
  const frame = (x: number, content: React.ReactNode, label?: string) => (
    <g key={x}>
      <rect x={x} y="6" width="42" height="48" fill={PALETTE.boneSoft} stroke={PALETTE.parchment} strokeWidth="0.8"/>
      {content}
      {label && <text x={x + 21} y="50" fontSize="6" fill={PALETTE.mute} textAnchor="middle" fontFamily="Inter, sans-serif" letterSpacing="0.5">{label}</text>}
    </g>
  );
  const sprocket = (x: number, key: number) => <rect key={key} x={x} y="2" width="3" height="3" fill={PALETTE.parchment} rx="0.5"/>;
  const pet = (cx: number, cy: number, scale = 1) => (
    <g transform={`translate(${cx},${cy}) scale(${scale})`}>
      <ellipse cx="0" cy="2" rx="6" ry="5" fill={PALETTE.brassDeep}/>
      <ellipse cx="0" cy="-2" rx="4" ry="3.5" fill={PALETTE.brass}/>
      <circle cx="-1.5" cy="-2" r="0.6" fill={PALETTE.espresso}/>
      <circle cx="1.5" cy="-2" r="0.6" fill={PALETTE.espresso}/>
    </g>
  );

  const common = { viewBox: `0 0 ${W} ${H}`, width, height, style: { display: 'block' } };

  const configs = {
    music_video: {
      frames: [
        { content: pet(0, 8, 1.2), label: 'OPEN' },
        { content: pet(-8, 6, 1.4), label: 'BEAT' },
        { content: pet(8, 4, 0.9), label: 'DROP' },
        { content: pet(0, 8, 1.6), label: 'PEAK' },
        { content: pet(0, 10, 1), label: 'OUT' },
      ]
    },
    biopic: {
      frames: [
        { content: pet(0, 12, 0.6), label: 'PUP' },
        { content: pet(0, 10, 0.9), label: 'GROW' },
        { content: pet(0, 8, 1.2), label: 'PRIME' },
        { content: pet(0, 8, 1.1), label: 'GOLD' },
        { content: pet(0, 8, 1.0), label: 'TRIB' },
      ]
    },
    day_in_the_life: {
      frames: [
        { content: pet(0, 8, 1), label: 'MORN' },
        { content: pet(0, 8, 1), label: 'PLAY' },
        { content: pet(0, 8, 1), label: 'NOON' },
        { content: pet(0, 8, 1), label: 'EVE' },
        { content: pet(0, 8, 1), label: 'REST' },
      ]
    },
    letter: {
      frames: [
        { content: <g><line x1="6" y1="14" x2="36" y2="14" stroke={PALETTE.brassDeep} strokeWidth="1"/><line x1="6" y1="18" x2="32" y2="18" stroke={PALETTE.brassDeep} strokeWidth="1"/><line x1="6" y1="22" x2="36" y2="22" stroke={PALETTE.brassDeep} strokeWidth="1"/></g>, label: 'DEAR' },
        { content: <><line x1="6" y1="14" x2="36" y2="14" stroke={PALETTE.brassDeep} strokeWidth="1"/>{pet(21, 24, 0.7)}</>, label: 'I' },
        { content: <><line x1="6" y1="14" x2="32" y2="14" stroke={PALETTE.brassDeep} strokeWidth="1"/>{pet(21, 26, 0.6)}</>, label: 'YOU' },
        { content: <line x1="6" y1="30" x2="36" y2="30" stroke={PALETTE.brassDeep} strokeWidth="1"/>, label: 'OURS' },
        { content: <text x="27" y="34" fontSize="8" fill={PALETTE.brassDeep} fontFamily="Cormorant Garamond, serif" fontStyle="italic" textAnchor="middle">—</text>, label: 'LOVE' },
      ]
    },
    greatest_hits: {
      frames: [
        { content: <><circle cx="21" cy="20" r="3" fill={PALETTE.brass}/><text x="21" y="22" fontSize="5" fill="white" textAnchor="middle">★</text></>, label: '01' },
        { content: <><circle cx="21" cy="20" r="3" fill={PALETTE.brass}/><text x="21" y="22" fontSize="5" fill="white" textAnchor="middle">★</text></>, label: '02' },
        { content: <><circle cx="21" cy="20" r="3" fill={PALETTE.brass}/><text x="21" y="22" fontSize="5" fill="white" textAnchor="middle">★</text></>, label: '03' },
        { content: <><circle cx="21" cy="20" r="3" fill={PALETTE.brass}/><text x="21" y="22" fontSize="5" fill="white" textAnchor="middle">★</text></>, label: '04' },
        { content: <><circle cx="21" cy="20" r="3" fill={PALETTE.brass}/><text x="21" y="22" fontSize="5" fill="white" textAnchor="middle">★</text></>, label: '05' },
      ]
    },
    send_off: {
      frames: [
        { content: pet(0, 10, 1), label: 'GATHER' },
        { content: pet(0, 8, 0.9), label: 'JOURNEY' },
        { content: <><line x1="6" y1="18" x2="36" y2="18" stroke={PALETTE.brass} strokeWidth="1.5" strokeDasharray="2 2"/>{pet(21, 24, 0.7)}</>, label: 'CROSS' },
        { content: pet(0, 8, 0.7), label: '↑' },
        { content: <circle cx="21" cy="18" r="6" fill={PALETTE.brass} opacity="0.4"/>, label: 'PEACE' },
      ]
    },
    postcards: {
      frames: [
        { content: <rect x="10" y="12" width="24" height="16" fill={PALETTE.boneSoft} stroke={PALETTE.brassDeep} strokeWidth="0.6"/>, label: '01' },
        { content: <rect x="10" y="12" width="24" height="16" fill={PALETTE.boneSoft} stroke={PALETTE.brassDeep} strokeWidth="0.6" transform="rotate(-4, 22, 20)"/>, label: '02' },
        { content: <rect x="10" y="12" width="24" height="16" fill={PALETTE.boneSoft} stroke={PALETTE.brassDeep} strokeWidth="0.6" transform="rotate(3, 22, 20)"/>, label: '03' },
        { content: <rect x="10" y="12" width="24" height="16" fill={PALETTE.boneSoft} stroke={PALETTE.brassDeep} strokeWidth="0.6" transform="rotate(-2, 22, 20)"/>, label: '04' },
        { content: <rect x="10" y="12" width="24" height="16" fill={PALETTE.boneSoft} stroke={PALETTE.brassDeep} strokeWidth="0.6"/>, label: 'XO' },
      ]
    },
    forever_young: {
      frames: [
        { content: pet(0, 6, 1.4), label: 'RUN' },
        { content: pet(0, 4, 1.3), label: 'LEAP' },
        { content: pet(0, 8, 1.0), label: 'NOW' },
        { content: pet(0, 8, 1.0), label: 'ALWAYS' },
        { content: pet(0, 6, 1.4), label: '∞' },
      ]
    },
  };

  const cfg = configs[formatId as keyof typeof configs] || configs.day_in_the_life;
  const frameWidth = 46;
  const startX = (W - cfg.frames.length * frameWidth) / 2;

  return (
    <svg {...common}>
      <rect width={W} height={H} fill={PALETTE.espresso}/>
      {Array.from({ length: 14 }).map((_, i) => sprocket(8 + i * 16, i))}
      {Array.from({ length: 14 }).map((_, i) => <rect key={i} x={8 + i * 16} y="55" width="3" height="3" fill={PALETTE.parchment} rx="0.5"/>)}
      {cfg.frames.map((f, i) => {
        const x = startX + i * frameWidth;
        return (
          <g key={i} transform={`translate(${x - 2}, 0)`}>
            <g transform="translate(2, 0)">
              {frame(0, <g transform="translate(21, 22)">{f.content}</g>, f.label)}
            </g>
          </g>
        );
      })}
    </svg>
  );
};

export default FormatThumb;
