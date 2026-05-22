"use client";

import React, { useEffect } from 'react';
import { PALETTE } from '../lib/palette';
import { Serif, Sans, StageShell } from '../lib/primitives';
import { useBuilder } from '../state';
import { captionContainers, containerForStyle } from '@/lib/peternal-library';
import type { StageProps } from './types';
import type { ContainerId } from '../state';

const LEAF = () => (
  <svg width={12} height={12} viewBox="0 0 12 12" style={{ display: 'inline-block', marginLeft: 4, verticalAlign: 'middle' }}>
    <path d="M6 1 Q10 3 10 7 Q8 11 6 11 Q4 11 2 7 Q2 3 6 1Z" fill={PALETTE.mute} opacity={0.6}/>
    <line x1="6" y1="11" x2="6" y2="4" stroke={PALETTE.mute} strokeWidth="0.8" opacity={0.5}/>
  </svg>
);

export default function CaptionContainer({ onNext, onBack }: StageProps) {
  const { state, update } = useBuilder();

  const recommended: ContainerId | null = state.style ? containerForStyle(state.style) : null;

  useEffect(() => {
    if (!state.captionContainer && recommended) {
      update({ captionContainer: recommended });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stylePaired = captionContainers.filter(c => c.group === 'style_paired');
  const memorial = captionContainers.filter(c => c.group === 'memorial');

  function select(id: ContainerId) {
    update({ captionContainer: id });
  }

  const selected = state.captionContainer ?? recommended;

  function renderCard(c: typeof captionContainers[number]) {
    const isSelected = selected === c.id;
    const isRecommended = c.id === recommended;
    return (
      <button
        key={c.id}
        onClick={() => select(c.id as ContainerId)}
        style={{
          textAlign: 'left',
          padding: '16px 18px',
          border: `1px solid ${isSelected ? PALETTE.espresso : PALETTE.parchmentLight}`,
          background: isSelected ? PALETTE.boneSoft : 'white',
          cursor: 'pointer',
          borderRadius: 4,
          transition: 'all 180ms ease',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          position: 'relative',
        }}
        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.borderColor = PALETTE.brass; }}
        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.borderColor = PALETTE.parchmentLight; }}
      >
        {isRecommended && (
          <div style={{
            position: 'absolute', top: -10, right: 12,
            background: PALETTE.brassDeep, color: 'white',
            fontFamily: 'Inter, sans-serif', fontSize: 10,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            padding: '2px 8px', borderRadius: 999,
          }}>
            Recommended for your style
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/container-thumbnails/peternal-container-${c.id}.png`}
          alt={`${c.name} caption container preview`}
          style={{
            width: '100%',
            aspectRatio: '1',
            objectFit: 'cover',
            borderRadius: 4,
            display: 'block',
            marginBottom: 4,
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Serif style={{ fontSize: 16, color: PALETTE.espresso }}>{c.name}</Serif>
          {c.leafIcon && <LEAF />}
          {isSelected && (
            <svg width={14} height={14} viewBox="0 0 14 14" style={{ marginLeft: 'auto', flexShrink: 0 }}>
              <circle cx="7" cy="7" r="7" fill={PALETTE.espresso}/>
              <path d="M4 7l2 2 4-4" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
        <Sans style={{ fontSize: 12, color: PALETTE.mute, lineHeight: 1.4, maxWidth: 280 }}>{c.spec.slice(0, 90)}…</Sans>
      </button>
    );
  }

  return (
    <StageShell
      eyebrow="Caption Container"
      title="How the words appear in the scene"
      lede="Each caption sits inside a styled container that's part of the illustration — choose the one that feels right."
      onNext={onNext}
      onBack={onBack}
      canNext={!!selected}
      nextLabel="Continue"
    >
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Sans style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: PALETTE.mute, fontWeight: 500 }}>
            Style-paired (8)
          </Sans>
          <div style={{ flex: 1, height: 1, background: PALETTE.parchmentLight }}/>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {stylePaired.map(c => renderCard(c))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Sans style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: PALETTE.mute, fontWeight: 500 }}>
          Memorial (5)
        </Sans>
        <div style={{ flex: 1, height: 1, background: PALETTE.parchmentLight }}/>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {memorial.map(c => renderCard(c))}
      </div>
    </StageShell>
  );
}
