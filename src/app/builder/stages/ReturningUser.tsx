"use client";

import React from 'react';
import { Pill, StageShell } from '../lib/primitives';
import { useBuilder } from '../state';
import type { StageProps } from './types';

export default function ReturningUser({ onNext, onBack }: StageProps) {
  const { state, update } = useBuilder();

  const choose = (value: boolean) => {
    update({ returningUser: value });
    onNext();
  };

  return (
    <StageShell
      eyebrow="About you"
      title={<>Have you made a tribute before?</>}
      lede="Just so we know where you're starting from."
      onBack={onBack}
      hideNext
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <Pill
          large
          active={state.returningUser === false}
          onClick={() => choose(false)}
        >
          No, this is my first
        </Pill>
        <Pill
          large
          active={state.returningUser === true}
          onClick={() => choose(true)}
        >
          Yes, I&apos;ve done this before
        </Pill>
      </div>
    </StageShell>
  );
}
