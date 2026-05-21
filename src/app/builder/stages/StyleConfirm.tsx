"use client";

import React, { useEffect, useRef } from 'react';
import { StageShell, Pill, Serif } from '../lib/primitives';
import { PALETTE } from '../lib/palette';
import { useBuilder } from '../state';
import type { StageProps } from '../state';
import { artStyles } from '@/lib/peternal-library';
import type { ArtStyleId } from '@/lib/peternal-library';

export default function StyleConfirm({ onNext, onBack }: StageProps) {
  const { state, update } = useBuilder();
  const skip = state.pickType !== 'curated';

  // Curated-path-only screen (Stage 3.1.5). On the manual path, advance *after*
  // render — calling onNext() during render would update the wizard mid-render.
  // The ref guard stops React StrictMode's double-invoke from advancing twice
  // (which previously skipped FormatPick entirely on the manual path).
  const skippedRef = useRef(false);
  useEffect(() => {
    if (skip && !skippedRef.current) {
      skippedRef.current = true;
      onNext();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);

  if (skip) return null;

  const currentStyleObj = artStyles.find(s => s.id === state.style) ?? artStyles[0];
  const currentStyleId = currentStyleObj.id;

  // Always exactly 8 pills: "Keep [style]" first, then the other 7 (suppressing duplicate).
  const otherStyles = artStyles.filter(s => s.id !== currentStyleId);

  function handleKeep() {
    onNext();
  }

  function handleSwitch(styleId: ArtStyleId) {
    update({ style: styleId });
    onNext();
  }

  return (
    <StageShell
      eyebrow="Direction — 3.1.5"
      title="One more thought on style"
      lede={
        <>
          This pick uses{' '}
          <Serif as="span" style={{ fontWeight: 600, color: PALETTE.espresso }}>
            {currentStyleObj.name}
          </Serif>
          {' '}— keep it, or switch to something else?
        </>
      }
      onBack={onBack}
      hideNext
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {/* "Keep [style]" pill always first */}
        <Pill active onClick={handleKeep} large>
          Keep {currentStyleObj.name}
        </Pill>
        {/* The other 7 styles */}
        {otherStyles.map(s => (
          <Pill key={s.id} onClick={() => handleSwitch(s.id)} large>
            {s.name}
          </Pill>
        ))}
      </div>
    </StageShell>
  );
}
