"use client";

import React from 'react';
import { PALETTE } from '../lib/palette';
import { StageShell, Serif, Sans } from '../lib/primitives';
import { useBuilder } from '../state';
import type { StageProps } from '../state';
import { artStyles } from '@/lib/peternal-library';
import type { ArtStyleId } from '@/lib/peternal-library';

// Warm and traditional: styles 1–6. Playful and stylized: pixel_art, voxel_minecraft.
const WARM_STYLES: ArtStyleId[] = [
  'cinematic_realism',
  'watercolor',
  'storybook_illustration',
  'animated_3d',
  'claymation',
  'pencil_sketch',
];
const PLAYFUL_STYLES: ArtStyleId[] = ['pixel_art', 'voxel_minecraft'];

// Extra opt-in framing for the two playful styles.
const OPT_IN_NOTE: Partial<Record<ArtStyleId, string>> = {
  pixel_art: 'A deliberate, joyful choice — wonderful for playful spirits.',
  voxel_minecraft: 'A deliberate, joyful choice — especially meaningful for families with kids.',
};

// Per-style zoom-crop. The handover composed the pets at varying sizes with
// breathing room, so a single crop value can't fill every card — these crop
// each thumbnail individually so the pets fill it with no empty background.
const STYLE_CROP: Record<ArtStyleId, { scale: number; originY: number }> = {
  cinematic_realism: { scale: 1.46, originY: 50 },
  watercolor: { scale: 1.38, originY: 56 },
  storybook_illustration: { scale: 1.38, originY: 56 },
  animated_3d: { scale: 1.66, originY: 62 },
  claymation: { scale: 1.5, originY: 52 },
  pencil_sketch: { scale: 1.38, originY: 56 },
  pixel_art: { scale: 1.64, originY: 62 },
  voxel_minecraft: { scale: 1.38, originY: 56 },
};

function StyleCard({ styleId, active, onClick }: { styleId: ArtStyleId; active: boolean; onClick: () => void }) {
  const style = artStyles.find(s => s.id === styleId);
  if (!style) return null;
  const note = OPT_IN_NOTE[styleId];
  const crop = STYLE_CROP[styleId];
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: 0,
        border: `1px solid ${active ? PALETTE.espresso : PALETTE.parchmentLight}`,
        background: active ? PALETTE.boneSoft : 'white',
        cursor: 'pointer',
        borderRadius: 4,
        overflow: 'hidden',
        transition: 'all 180ms ease',
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.borderColor = PALETTE.brass; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.borderColor = PALETTE.parchmentLight; }}
    >
      {/* Each thumbnail is zoom-cropped per STYLE_CROP so the pets fill the
          card — the handover composed them at varying sizes. */}
      <div style={{ width: '100%', aspectRatio: '4 / 3', overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/style-thumbnails/peterna-style-${styleId}.png`}
          alt={`${style.name} art style preview`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            transform: `scale(${crop.scale})`,
            transformOrigin: `center ${crop.originY}%`,
          }}
        />
      </div>
      <div style={{ padding: '10px 12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 15 }}>{style.emoji}</span>
          <Serif style={{ fontSize: 16, color: PALETTE.espresso }}>{style.name}</Serif>
        </div>
        <Serif italic style={{ fontSize: 12, color: PALETTE.mute, lineHeight: 1.4 }}>{style.desc}</Serif>
        {note && (
          <Sans style={{ fontSize: 11, color: PALETTE.brassDeep, marginTop: 6, lineHeight: 1.3 }}>{note}</Sans>
        )}
      </div>
    </button>
  );
}

export default function StylePick({ onNext, onBack }: StageProps) {
  const { state, update } = useBuilder();

  function handleSelect(id: ArtStyleId) {
    update({ style: id });
    onNext();
  }

  return (
    <StageShell
      eyebrow="Direction — 3.4"
      title="How should it look?"
      lede="The art style shapes every frame. Each one tells the same story differently."
      onBack={onBack}
      hideNext
    >
      <Sans style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: PALETTE.mute, marginBottom: 12 }}>
        Warm and traditional
      </Sans>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 28 }}>
        {WARM_STYLES.map(id => (
          <StyleCard key={id} styleId={id} active={state.style === id} onClick={() => handleSelect(id)} />
        ))}
      </div>

      <div style={{ borderTop: `1px solid ${PALETTE.parchmentLight}`, marginBottom: 20 }} />

      <Sans style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: PALETTE.mute, marginBottom: 12 }}>
        Playful and stylized
      </Sans>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {PLAYFUL_STYLES.map(id => (
          <StyleCard key={id} styleId={id} active={state.style === id} onClick={() => handleSelect(id)} />
        ))}
      </div>
    </StageShell>
  );
}
