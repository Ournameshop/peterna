import React from 'react';
import { PALETTE } from '../lib/palette';

interface StyleSwatchProps {
  styleId: string;
  width?: number | string;
  height?: number | string;
}

const StyleSwatch = ({ styleId, width = '100%', height = 110 }: StyleSwatchProps) => {
  const W = 200, H = 130;
  const common = { viewBox: `0 0 ${W} ${H}`, width, height, preserveAspectRatio: 'xMidYMid slice', style: { display: 'block', borderRadius: 2 } };

  switch (styleId) {
    case 'cinematic_realism':
      return (
        <svg {...common}>
          <defs>
            <radialGradient id="cr-sky" cx="0.6" cy="0.3" r="0.9">
              <stop offset="0%" stopColor="#F5D9A8"/>
              <stop offset="60%" stopColor="#C99668"/>
              <stop offset="100%" stopColor="#5A3826"/>
            </radialGradient>
            <linearGradient id="cr-ground" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7A4D2E"/>
              <stop offset="100%" stopColor="#2E1B0F"/>
            </linearGradient>
            <filter id="cr-soft"><feGaussianBlur stdDeviation="0.4"/></filter>
          </defs>
          <rect width={W} height={H} fill="url(#cr-sky)"/>
          <rect y="86" width={W} height="44" fill="url(#cr-ground)"/>
          <ellipse cx="100" cy="92" rx="14" ry="3" fill="rgba(0,0,0,0.4)" filter="url(#cr-soft)"/>
          <g filter="url(#cr-soft)">
            <ellipse cx="100" cy="80" rx="13" ry="11" fill="#3A2818"/>
            <ellipse cx="100" cy="72" rx="9" ry="7.5" fill="#4A3220"/>
            <ellipse cx="96" cy="70" rx="1.4" ry="1.8" fill="#1A0E08"/>
            <ellipse cx="104" cy="70" rx="1.4" ry="1.8" fill="#1A0E08"/>
          </g>
          <rect width={W} height={H} fill="rgba(0,0,0,0.05)"/>
        </svg>
      );

    case 'watercolor':
      return (
        <svg {...common}>
          <defs>
            <filter id="wc-bleed" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence baseFrequency="0.9" numOctaves="2" seed="3"/>
              <feDisplacementMap in="SourceGraphic" scale="3"/>
            </filter>
            <filter id="wc-paper">
              <feTurbulence baseFrequency="0.85" numOctaves="1"/>
              <feColorMatrix values="0 0 0 0 0.95  0 0 0 0 0.92  0 0 0 0 0.83  0 0 0 0.15 0"/>
            </filter>
          </defs>
          <rect width={W} height={H} fill="#FBF4E5"/>
          <rect width={W} height={H} filter="url(#wc-paper)"/>
          <g filter="url(#wc-bleed)" opacity="0.7">
            <ellipse cx="60" cy="50" rx="55" ry="22" fill="#E8B4B8"/>
            <ellipse cx="140" cy="40" rx="50" ry="18" fill="#D9A574"/>
          </g>
          <g filter="url(#wc-bleed)" opacity="0.55">
            <ellipse cx="100" cy="100" rx="80" ry="18" fill="#8FA67E"/>
          </g>
          <g filter="url(#wc-bleed)" opacity="0.75">
            <ellipse cx="100" cy="80" rx="13" ry="11" fill="#A87850"/>
            <ellipse cx="100" cy="72" rx="9" ry="7.5" fill="#C49169"/>
          </g>
          <ellipse cx="96" cy="71" r="1" fill="#3A2818"/>
          <ellipse cx="104" cy="71" r="1" fill="#3A2818"/>
        </svg>
      );

    case 'storybook_illustration':
      return (
        <svg {...common}>
          <defs>
            <pattern id="sb-paper" width="4" height="4" patternUnits="userSpaceOnUse">
              <rect width="4" height="4" fill="#FAEFD8"/>
              <circle cx="1" cy="1" r="0.3" fill="#E8D8B5" opacity="0.6"/>
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#sb-paper)"/>
          <path d="M 0 95 Q 40 88 100 92 T 200 90 L 200 130 L 0 130 Z" fill="#A8C982"/>
          <path d="M 0 100 Q 50 96 100 98 T 200 96 L 200 130 L 0 130 Z" fill="#8AB068"/>
          <g>
            {[30, 60, 90, 130, 165].map((x, i) => (
              <g key={i}>
                <circle cx={x} cy="98" r="2.2" fill="#F5D8E0"/>
                <circle cx={x} cy="96" r="0.8" fill="#FBF4E5"/>
              </g>
            ))}
          </g>
          <g stroke="#5C3A1F" strokeWidth="1.2" fill="#D89B6E" strokeLinejoin="round">
            <ellipse cx="100" cy="82" rx="14" ry="12"/>
            <ellipse cx="100" cy="73" rx="10" ry="8"/>
            <path d="M 89 68 Q 86 60 92 62 Q 94 65 94 70 Z"/>
            <path d="M 111 68 Q 114 60 108 62 Q 106 65 106 70 Z"/>
          </g>
          <circle cx="96" cy="73" r="1.4" fill="#2E1B0F"/>
          <circle cx="104" cy="73" r="1.4" fill="#2E1B0F"/>
          <circle cx="50" cy="22" r="9" fill="#F8D875"/>
        </svg>
      );

    case 'animated_3d':
      return (
        <svg {...common}>
          <defs>
            <radialGradient id="a3-sky" cx="0.5" cy="0.4">
              <stop offset="0%" stopColor="#FFE9C2"/>
              <stop offset="100%" stopColor="#E0A875"/>
            </radialGradient>
            <radialGradient id="a3-body" cx="0.35" cy="0.3">
              <stop offset="0%" stopColor="#F4C896"/>
              <stop offset="60%" stopColor="#C58850"/>
              <stop offset="100%" stopColor="#6E3F1E"/>
            </radialGradient>
            <radialGradient id="a3-ground" cx="0.5" cy="0.0">
              <stop offset="0%" stopColor="#7BA85E"/>
              <stop offset="100%" stopColor="#4A6B38"/>
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill="url(#a3-sky)"/>
          <rect y="90" width={W} height="40" fill="url(#a3-ground)"/>
          <ellipse cx="100" cy="94" rx="18" ry="3" fill="rgba(0,0,0,0.3)"/>
          <ellipse cx="100" cy="80" rx="15" ry="13" fill="url(#a3-body)"/>
          <ellipse cx="100" cy="70" rx="11" ry="9" fill="url(#a3-body)"/>
          <ellipse cx="89" cy="62" rx="4" ry="6" fill="#6E3F1E"/>
          <ellipse cx="111" cy="62" rx="4" ry="6" fill="#6E3F1E"/>
          <ellipse cx="96" cy="69" rx="2.2" ry="2.8" fill="white"/>
          <ellipse cx="104" cy="69" rx="2.2" ry="2.8" fill="white"/>
          <circle cx="96" cy="70" r="1.4" fill="#0F0805"/>
          <circle cx="104" cy="70" r="1.4" fill="#0F0805"/>
          <circle cx="96.5" cy="69.4" r="0.5" fill="white"/>
          <circle cx="104.5" cy="69.4" r="0.5" fill="white"/>
        </svg>
      );

    case 'claymation':
      return (
        <svg {...common}>
          <defs>
            <filter id="cl-tex" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence baseFrequency="0.6" numOctaves="2" seed="2"/>
              <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0"/>
              <feComposite in2="SourceGraphic" operator="in"/>
            </filter>
            <radialGradient id="cl-bg" cx="0.5" cy="0.5">
              <stop offset="0%" stopColor="#E8C896"/>
              <stop offset="100%" stopColor="#7A5832"/>
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill="url(#cl-bg)"/>
          <ellipse cx="100" cy="115" rx="120" ry="12" fill="#5C3E22"/>
          <g>
            <ellipse cx="100" cy="80" rx="15" ry="12" fill="#B87B4E"/>
            <ellipse cx="100" cy="80" rx="15" ry="12" fill="white" filter="url(#cl-tex)"/>
            <ellipse cx="100" cy="71" rx="11" ry="9" fill="#C99060"/>
            <ellipse cx="100" cy="71" rx="11" ry="9" fill="white" filter="url(#cl-tex)"/>
            <ellipse cx="92" cy="62" rx="5" ry="7" fill="#9A6638"/>
            <ellipse cx="108" cy="62" rx="5" ry="7" fill="#9A6638"/>
            <circle cx="96" cy="70" r="1.6" fill="#1A0E08"/>
            <circle cx="104" cy="70" r="1.6" fill="#1A0E08"/>
            <ellipse cx="100" cy="76" rx="1.6" ry="1.2" fill="#3A1E10"/>
          </g>
          {[20, 50, 150, 180].map((x, i) => (
            <g key={i}>
              <ellipse cx={x} cy="100" rx="6" ry="3" fill="#7A5226"/>
              <ellipse cx={x} cy="100" rx="6" ry="3" fill="white" filter="url(#cl-tex)"/>
            </g>
          ))}
        </svg>
      );

    case 'pencil_sketch':
      return (
        <svg {...common}>
          <defs>
            <pattern id="ps-paper" width="4" height="4" patternUnits="userSpaceOnUse">
              <rect width="4" height="4" fill="#F4E8D0"/>
              <circle cx="1.5" cy="1.5" r="0.4" fill="#D6C5A1" opacity="0.4"/>
              <circle cx="3" cy="3" r="0.3" fill="#C8B58F" opacity="0.3"/>
            </pattern>
            <pattern id="ps-hatch" width="3" height="3" patternUnits="userSpaceOnUse">
              <line x1="0" y1="3" x2="3" y2="0" stroke="#3A2818" strokeWidth="0.4" opacity="0.6"/>
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#ps-paper)"/>
          <g stroke="#2E1B0F" fill="none" strokeWidth="0.8" strokeLinecap="round">
            <ellipse cx="100" cy="80" rx="14" ry="12"/>
            <ellipse cx="100" cy="80" rx="14" ry="12" fill="url(#ps-hatch)" opacity="0.5" stroke="none"/>
            <ellipse cx="100" cy="72" rx="10" ry="8"/>
            <path d="M 88 65 Q 86 58 92 60"/>
            <path d="M 112 65 Q 114 58 108 60"/>
            <circle cx="96" cy="71" r="1.2" fill="#2E1B0F"/>
            <circle cx="104" cy="71" r="1.2" fill="#2E1B0F"/>
            <path d="M 98 77 Q 100 79 102 77"/>
          </g>
          <g stroke="#2E1B0F" strokeWidth="0.5" opacity="0.4">
            <line x1="70" y1="96" x2="130" y2="96"/>
            <line x1="74" y1="98" x2="128" y2="98"/>
            <line x1="78" y1="100" x2="124" y2="100"/>
          </g>
        </svg>
      );

    case 'pixel_art':
      return (
        <svg {...common} shapeRendering="crispEdges">
          <rect width={W} height={H} fill="#8AC4D8"/>
          <rect y="78" width={W} height="52" fill="#6B9A4E"/>
          <rect y="86" width={W} height="44" fill="#588040"/>
          {(() => {
            const px = 6; const ox = 84; const oy = 60;
            const grid = [
              '..xx....xx..',
              '.xddx..xddx.',
              'xdddxxxxddx',
              'xdwwddddwwx',
              'xdwwddddwwx',
              'xddddXXdddx',
              'xddddddddx.',
              '.xxxxxxxx..',
            ];
            const colors = { x: '#3A2818', d: '#C58850', w: '#FBF4E5', X: '#1A0E08' };
            return grid.flatMap((row, y) => [...row].map((ch, x) => {
              const fill = colors[ch as keyof typeof colors];
              if (!fill) return null;
              return <rect key={`${x}-${y}`} x={ox + x * px} y={oy + y * px} width={px} height={px} fill={fill}/>;
            }));
          })()}
          <rect x="20" y="14" width="14" height="14" fill="#F8D875"/>
          <rect x="22" y="12" width="10" height="2" fill="#F8D875"/>
          <rect x="22" y="28" width="10" height="2" fill="#F8D875"/>
          <rect x="34" y="16" width="2" height="10" fill="#F8D875"/>
          <rect x="18" y="16" width="2" height="10" fill="#F8D875"/>
        </svg>
      );

    case 'voxel_minecraft':
      return (
        <svg {...common} shapeRendering="crispEdges">
          <defs>
            <linearGradient id="vx-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A8D8F0"/>
              <stop offset="100%" stopColor="#D8E8F0"/>
            </linearGradient>
          </defs>
          <rect width={W} height={H} fill="url(#vx-sky)"/>
          {Array.from({ length: 14 }).map((_, i) => (
            <g key={i}>
              <rect x={i * 15} y={88} width="15" height="6" fill="#5A8A3A"/>
              <rect x={i * 15} y={94} width="15" height="36" fill="#7A5232"/>
              <rect x={i * 15} y={94} width="15" height="2" fill="#8C6240"/>
              <rect x={i * 15} y={88} width="2" height="42" fill="rgba(0,0,0,0.15)"/>
            </g>
          ))}
          <g>
            <rect x="90" y="68" width="20" height="20" fill="#C58850"/>
            <rect x="90" y="68" width="20" height="2" fill="#D9A074"/>
            <rect x="108" y="68" width="2" height="20" fill="rgba(0,0,0,0.18)"/>
            <rect x="94" y="74" width="3" height="3" fill="#1A0E08"/>
            <rect x="103" y="74" width="3" height="3" fill="#1A0E08"/>
            <rect x="98" y="82" width="4" height="2" fill="#3A1E10"/>
            <rect x="86" y="64" width="6" height="6" fill="#A86F3E"/>
            <rect x="108" y="64" width="6" height="6" fill="#A86F3E"/>
            <rect x="84" y="86" width="32" height="4" fill="rgba(0,0,0,0.25)"/>
          </g>
          <rect x="30" y="20" width="30" height="8" fill="white"/>
          <rect x="36" y="14" width="18" height="6" fill="white"/>
        </svg>
      );

    default:
      return <svg {...common}><rect width={W} height={H} fill={PALETTE.parchment}/></svg>;
  }
};

export default StyleSwatch;
