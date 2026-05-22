"use client";

import React from 'react';
import { PALETTE } from '../lib/palette';
import { StageShell, Serif } from '../lib/primitives';
import { useBuilder } from '../state';
import type { StageProps } from '../state';
import { formats } from '@/lib/peternal-library';
import type { FormatId } from '@/lib/peternal-library';

// Feather-style line-icon paths, one per format. Rendered monochrome in the
// brand brown so the format cards match the screenshot reference.
const ICON_PATHS: Record<FormatId, React.ReactNode> = {
  music_video: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  biopic: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>,
  day_in_the_life: <><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></>,
  letter: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>,
  greatest_hits: <><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></>,
  send_off: <><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" /><line x1="16" y1="8" x2="2" y2="22" /><line x1="17.5" y1="15" x2="9" y2="15" /></>,
  postcards: <><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>,
  forever_young: <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></>,
};

function FormatIcon({ id }: { id: FormatId }) {
  return (
    <svg
      width={17}
      height={17}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICON_PATHS[id]}
    </svg>
  );
}

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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/format-thumbnails/peterna-format-${f.id}.png`}
                alt={`${f.name} format preview`}
                style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
              />
              <div style={{ padding: '12px 14px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                  <span style={{ display: 'flex', flexShrink: 0, color: PALETTE.espressoSoft }}>
                    <FormatIcon id={f.id} />
                  </span>
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
