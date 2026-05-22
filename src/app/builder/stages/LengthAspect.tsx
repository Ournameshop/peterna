"use client";

import React, { useState } from 'react';
import { PALETTE } from '../lib/palette';
import { Serif, Sans, StageShell } from '../lib/primitives';
import { useBuilder } from '../state';
import { lengths, aspects } from '@/lib/peternal-library';
import type { StageProps } from '../state';
import type { AspectId } from '../state';

type InternalStep = 'length' | 'aspect';

export default function LengthAspect({ onNext, onBack }: StageProps) {
  const { state, update, resetDownstream } = useBuilder();
  const [step, setStep] = useState<InternalStep>('length');

  function selectLength(beatCount: 8 | 12 | 16, targetMinutes: 1 | 2 | 3 | 4) {
    // 1- and 2-minute both use 8 beats, so the choice can change without
    // beatCount changing — check targetMinutes too.
    if (state.beatCount !== beatCount || state.targetMinutes !== targetMinutes) {
      update({ beatCount, targetMinutes });
      resetDownstream('length_aspect');
    }
    setStep('aspect');
  }

  function selectAspect(aspectRatio: AspectId) {
    update({ aspectRatio });
  }

  if (step === 'length') {
    return (
      <StageShell
        eyebrow="Length"
        title={<>How long should <em>{state.petName ? `${state.petName}'s` : 'the'}</em> tribute be?</>}
        lede="Every length tells a complete story. Choose what feels right for who they were."
        onNext={() => setStep('aspect')}
        onBack={onBack}
        canNext={true}
        nextLabel="Choose format"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lengths.map(len => {
            const active = state.targetMinutes === len.targetMinutes;
            const recommended = len.beatCount === 12;
            return (
              <button
                key={len.id}
                onClick={() => selectLength(len.beatCount, len.targetMinutes)}
                style={{
                  textAlign: 'left',
                  padding: '20px 22px',
                  border: `1px solid ${active ? PALETTE.espresso : PALETTE.parchmentLight}`,
                  background: active ? PALETTE.boneSoft : 'white',
                  borderRadius: 4,
                  cursor: 'pointer',
                  transition: 'all 180ms ease',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
                onMouseEnter={e => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.borderColor = PALETTE.brass;
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.borderColor = PALETTE.parchmentLight;
                }}
              >
                {recommended && (
                  <Sans style={{
                    position: 'absolute', top: 12, right: 14,
                    fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: PALETTE.brassDeep, fontWeight: 500,
                  }}>
                    Recommended
                  </Sans>
                )}
                <Serif style={{ fontSize: 22, color: PALETTE.espresso }}>
                  {len.targetMinutes === 1
                    ? 'A brief tribute'
                    : len.targetMinutes === 2
                      ? 'A short keepsake'
                      : len.targetMinutes === 3
                        ? 'A full tribute'
                        : 'An extended remembrance'}
                </Serif>
                <Sans style={{ fontSize: 13, color: PALETTE.mute }}>
                  {len.targetMinutes} minutes · {len.beatCount} beats
                </Sans>
              </button>
            );
          })}
        </div>
      </StageShell>
    );
  }

  return (
    <StageShell
      eyebrow="Aspect Ratio"
      title={<>Which screen <em>shape</em> feels right?</>}
      lede="The tribute will be rendered in this format. You can change it any time before generation."
      onNext={onNext}
      onBack={() => setStep('length')}
      canNext={true}
      nextLabel="Continue"
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {aspects.map(asp => {
          const active = state.aspectRatio === asp.id;
          return (
            <button
              key={asp.id}
              onClick={() => selectAspect(asp.id)}
              style={{
                textAlign: 'left',
                padding: '20px 20px',
                border: `1px solid ${active ? PALETTE.espresso : PALETTE.parchmentLight}`,
                background: active ? PALETTE.boneSoft : 'white',
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'all 180ms ease',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                alignItems: 'center',
              }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLButtonElement).style.borderColor = PALETTE.brass;
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLButtonElement).style.borderColor = PALETTE.parchmentLight;
              }}
            >
              <AspectPreview ratio={asp.ratio} active={active} isAllThree={asp.id === 'all_three'} />
              <Serif style={{ fontSize: 18, color: PALETTE.espresso, textAlign: 'center' }}>{asp.name}</Serif>
              <Sans style={{ fontSize: 12, color: PALETTE.mute, textAlign: 'center' }}>{asp.subtitle}</Sans>
            </button>
          );
        })}
      </div>
    </StageShell>
  );
}

function AspectPreview({ ratio, active, isAllThree }: { ratio: string; active: boolean; isAllThree: boolean }) {
  const color = active ? PALETTE.espresso : PALETTE.parchment;

  if (isAllThree) {
    return (
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 48 }}>
        <div style={{ width: 18, height: 32, border: `1.5px solid ${color}`, borderRadius: 2 }} />
        <div style={{ width: 28, height: 18, border: `1.5px solid ${color}`, borderRadius: 2 }} />
        <div style={{ width: 22, height: 22, border: `1.5px solid ${color}`, borderRadius: 2 }} />
      </div>
    );
  }

  const [w, h] = ratio.split(' / ').map(Number);
  const maxH = 48;
  const maxW = 64;
  const scale = Math.min(maxH / h, maxW / w);
  const displayW = Math.round(w * scale);
  const displayH = Math.round(h * scale);

  return (
    <div style={{
      width: displayW, height: displayH,
      border: `1.5px solid ${color}`,
      borderRadius: 2,
      background: active ? `rgba(42,33,27,0.06)` : 'transparent',
      flexShrink: 0,
    }} />
  );
}
