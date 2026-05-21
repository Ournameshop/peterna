import React from 'react';
import { PALETTE } from '../lib/palette';

interface CardArtProps {
  containerId: string;
  text?: string;
  aspectRatio?: string;
  artStyle?: string;
  cardType?: string;
}

// Card types: 'opening' = title card, 'closing' = end card, 'caption' = in-scene caption
// containerId drives the visual treatment; aspectRatio drives the frame shape.

const CONTAINER_COLORS = {
  cinematic_lower_third: { bg: '#0E0E12CC', text: '#F4F1E8', mode: 'lower_third' },
  watercolor_ribbon:     { bg: '#F1E7D2', text: '#6B4A2E', mode: 'ribbon' },
  storybook_page:        { bg: '#F3E9CF', text: '#5A3E1F', mode: 'page' },
  parchment_scroll:      { bg: '#E8D9B5', text: '#5A3E1F', mode: 'scroll' },
  plasticine_banner:     { bg: '#D9B98E', text: '#3A2A1C', mode: 'banner' },
  paperclip_note:        { bg: '#EFE6D2', text: '#3C3A36', mode: 'note' },
  pixel_sign:            { bg: '#8A5A33', text: '#F2E4C4', mode: 'pixel' },
  voxel_sign:            { bg: '#9C6B3C', text: '#2E2418', mode: 'voxel' },
  engraved_stone_plaque: { bg: '#8B8378', text: '#F4F1E8', mode: 'stone' },
  polaroid_border:       { bg: '#F8F4EC', text: '#2A3855', mode: 'polaroid' },
  postcard_back:         { bg: '#F0E5C8', text: '#1F3A5C', mode: 'postcard' },
  embroidered_sampler:   { bg: '#F4EAD5', text: '#C84A4A', mode: 'embroidery' },
  pressed_flower_bookmark: { bg: '#ECDFC5', text: '#5A3520', mode: 'bookmark' },
};

const STYLE_GRADIENTS = {
  cinematic_realism:       'linear-gradient(160deg, #2A1F15 0%, #5C3E28 50%, #3A2818 100%)',
  watercolor:              'linear-gradient(160deg, #F1E8DE 0%, #D4B8A0 50%, #BFA08A 100%)',
  storybook_illustration:  'linear-gradient(160deg, #C8DFC8 0%, #A8C4A8 50%, #7BA87B 100%)',
  animated_3d:             'linear-gradient(160deg, #E0D0C0 0%, #C8A890 50%, #9A7858 100%)',
  claymation:              'linear-gradient(160deg, #D4B090 0%, #B08060 50%, #8C5C38 100%)',
  pencil_sketch:           'linear-gradient(160deg, #EDE8E0 0%, #D4CCBE 50%, #B0A898 100%)',
  pixel_art:               'linear-gradient(160deg, #F0D080 0%, #C8A040 50%, #804010 100%)',
  voxel_minecraft:         'linear-gradient(160deg, #70A030 0%, #508020 50%, #306010 100%)',
};

// Renders a single "card in the scene" — title, closing, or caption overlay.
const CardArt = ({ containerId, text, aspectRatio, artStyle, cardType = 'caption' }: CardArtProps) => {
  const maxW = aspectRatio === '16:9' ? 320 : aspectRatio === '9:16' ? 160 : 220;

  const containerStyle = CONTAINER_COLORS[containerId as keyof typeof CONTAINER_COLORS]
    || { bg: PALETTE.boneSoft, text: PALETTE.espresso, mode: 'default' };
  const sceneGradient = STYLE_GRADIENTS[artStyle as keyof typeof STYLE_GRADIENTS]
    || 'linear-gradient(160deg, #3A2818 0%, #5C3E28 100%)';
  const isPolaroid = containerStyle.mode === 'polaroid';

  // Soft light bloom
  const bloom = (
    <ellipse cx="50%" cy="35%" rx="40%" ry="30%" fill="rgba(255,240,200,0.12)"/>
  );

  // Title card: big centered text block
  // Caption card: lower-third or container object at bottom
  // Closing card: centered with soft fade

  const textLabel = text || (cardType === 'opening' ? 'Opening' : cardType === 'closing' ? 'Closing' : 'Caption');
  const displayText = textLabel.length > 60 ? textLabel.slice(0, 57) + '…' : textLabel;

  // Container panel geometry (as % of SVG viewBox 100×100 or 100×178 etc.)
  // We'll use a fixed 100×100 viewBox and let aspectRatio control the outer box.
  const vbH = aspectRatio === '9:16' ? 178 : aspectRatio === '16:9' ? 56 : 100;

  const panelY = cardType === 'opening' || cardType === 'closing' ? vbH * 0.38 : vbH * 0.72;
  const panelH = 18;
  const panelX = 10;
  const panelW = 80;
  const rx = containerStyle.mode === 'ribbon' || containerStyle.mode === 'note' ? 3
    : containerStyle.mode === 'stone' ? 2
    : containerStyle.mode === 'banner' ? 4
    : 2;

  // Polaroid: white frame with wide bottom margin
  if (isPolaroid) {
    return (
      <div style={{ width: maxW, maxWidth: '100%' }}>
        <svg viewBox={`0 0 100 ${vbH}`} width="100%" style={{ display: 'block', borderRadius: 2 }}>
          <defs>
            <linearGradient id={`sg_${containerId}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2A1F15"/>
              <stop offset="100%" stopColor="#5C3E28"/>
            </linearGradient>
          </defs>
          {/* Polaroid white frame */}
          <rect x="4" y="4" width="92" height={vbH - 12} rx="2" fill="#F8F4EC" filter="url(#shadow)"/>
          {/* Scene area */}
          <rect x="8" y="8" width="84" height={vbH - 30} rx="1" fill={sceneGradient}/>
          <ellipse cx="50" cy={vbH * 0.3} rx="28" ry="20" fill="rgba(255,240,200,0.1)"/>
          {/* Caption in bottom white margin */}
          <text x="50" y={vbH - 8} textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic"
            fontSize="5" fill={containerStyle.text} letterSpacing="0.02em">{displayText}</text>
        </svg>
      </div>
    );
  }

  return (
    <div style={{ width: maxW, maxWidth: '100%' }}>
      <svg viewBox={`0 0 100 ${vbH}`} width="100%" style={{ display: 'block', borderRadius: 2 }}>
        <defs>
          <filter id={`shadow_${containerId.slice(0, 6)}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.2)"/>
          </filter>
        </defs>
        {/* Scene background */}
        <rect x="0" y="0" width="100" height={vbH} fill={sceneGradient}/>
        {bloom}

        {/* Container panel */}
        <rect
          x={panelX} y={panelY} width={panelW} height={panelH}
          rx={rx}
          fill={containerStyle.bg}
          filter={`url(#shadow_${containerId.slice(0, 6)})`}
          opacity={containerStyle.mode === 'cinematic_lower_third' ? 0.88 : 1}
        />

        {/* Scroll curls */}
        {containerStyle.mode === 'scroll' && <>
          <ellipse cx={panelX + 2} cy={panelY + panelH / 2} rx="3" ry={panelH / 2} fill="#D4C098"/>
          <ellipse cx={panelX + panelW - 2} cy={panelY + panelH / 2} rx="3" ry={panelH / 2} fill="#D4C098"/>
        </>}

        {/* Stone chiseled border */}
        {containerStyle.mode === 'stone' && (
          <rect x={panelX + 1} y={panelY + 1} width={panelW - 2} height={panelH - 2} rx={rx}
            fill="none" stroke="#6A6360" strokeWidth="0.8"/>
        )}

        {/* Pixel chunky border */}
        {containerStyle.mode === 'pixel' && <>
          <rect x={panelX - 1} y={panelY - 1} width={panelW + 2} height={panelH + 2} rx={0} fill="none" stroke="#5A3A1A" strokeWidth="1.5"/>
        </>}

        {/* Text */}
        <text
          x={panelX + panelW / 2}
          y={panelY + panelH / 2 + 1.8}
          textAnchor="middle"
          fontFamily={containerStyle.mode === 'pixel' || containerStyle.mode === 'voxel' ? 'monospace' : 'Georgia, "Cormorant Garamond", serif'}
          fontStyle={containerStyle.mode === 'pixel' || containerStyle.mode === 'voxel' ? 'normal' : 'italic'}
          fontSize={cardType === 'opening' || cardType === 'closing' ? 5.5 : 4.8}
          fill={containerStyle.text}
          letterSpacing={containerStyle.mode === 'pixel' ? '0.05em' : '0.02em'}
        >
          {displayText}
        </text>

        {/* Eyebrow label — text is authored upper-case (SVG <text> has no textTransform attr) */}
        <text x="50" y={panelY - 3} textAnchor="middle"
          fontFamily="Inter, sans-serif" fontSize="3" fill="rgba(255,255,255,0.5)" letterSpacing="0.12em">
          {cardType === 'opening' ? 'OPENING TITLE' : cardType === 'closing' ? 'CLOSING CARD' : 'CAPTION'}
        </text>
      </svg>
    </div>
  );
};

export default CardArt;
