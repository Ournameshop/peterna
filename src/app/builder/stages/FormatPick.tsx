"use client";

import React from 'react';
import { PALETTE } from '../lib/palette';
import { StageShell, Serif } from '../lib/primitives';
import { FormatThumb } from '../art';
import { useBuilder } from '../state';
import type { StageProps } from '../state';
import { formats } from '@/lib/peternal-library';
import type { FormatId } from '@/lib/peternal-library';

// Format icon characters, one per format in library order.
const FORMAT_ICONS: Record<FormatId, string> = {
  music_video: '🎬',
  biopic: '📖',
  day_in_the_life: '☀️',
  letter: '✉️',
  greatest_hits: '⭐',
  send_off: '🕊️',
  postcards: '📮',
  forever_young: '✨',
};

export default function FormatPick({ onNext, goToStep }: StageProps) {
  const { state, update } = useBuilder();

  function handleSelect(id: FormatId) {
    update({ format: id });
    onNext();
  }

  return (
    <StageShell
      eyebrow="Direction — 3.2"
      title="What shape should this take?"
      lede="Each format gives the tribute its own emotional rhythm."
      onBack={() => goToStep('curators')}
      hideNext
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {formats.map(f => {
          const isActive = state.format === f.id;
          return (
            <button
              key={f.id}
              onClick={() => handleSelect(f.id)}
              style={{
                textAlign: 'left',
                padding: 0,
                border: `1px solid ${isActive ? PALETTE.espresso : PALETTE.parchmentLight}`,
                background: isActive ? PALETTE.boneSoft : 'white',
                cursor: 'pointer',
                borderRadius: 4,
                overflow: 'hidden',
                transition: 'all 180ms ease',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.borderColor = PALETTE.brass; }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.borderColor = PALETTE.parchmentLight; }}
            >
              <div style={{ pointerEvents: 'none' }}>
                <FormatThumb formatId={f.id} width="100%" height={56} />
              </div>
              <div style={{ padding: '12px 14px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                  <span style={{ fontSize: 16 }}>{FORMAT_ICONS[f.id]}</span>
                  <Serif style={{ fontSize: 17, color: PALETTE.espresso }}>{f.name}</Serif>
                </div>
                <Serif italic style={{ fontSize: 13, color: PALETTE.mute, lineHeight: 1.4 }}>{f.desc}</Serif>
              </div>
            </button>
          );
        })}
      </div>
    </StageShell>
  );
}
