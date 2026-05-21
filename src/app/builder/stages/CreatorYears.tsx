"use client";

import React, { useState } from 'react';
import { PALETTE } from '../lib/palette';
import { Sans, Pill, StageShell, FieldGroup } from '../lib/primitives';
import { useBuilder } from '../state';
import type { StageProps } from './types';

type YearsPillId = 'provide' | 'rather_not' | 'skip';

export default function CreatorYears({ onNext, onBack }: StageProps) {
  const { state, update } = useBuilder();
  const [creatorName, setCreatorName] = useState(state.creatorName);
  const [yearsPill, setYearsPill] = useState<YearsPillId | null>(
    state.yearsIncluded ? 'provide' : state.years === '' ? null : 'rather_not',
  );
  const [yearsInput, setYearsInput] = useState(state.years);

  const name = state.petName || 'your pet';

  function handleCreatorChange(val: string) {
    setCreatorName(val);
    update({ creatorName: val });
  }

  function selectYearsPill(id: YearsPillId) {
    setYearsPill(id);
    if (id === 'provide') {
      update({ yearsIncluded: true, years: yearsInput });
    } else if (id === 'rather_not') {
      update({ yearsIncluded: false, years: '' });
    } else {
      update({ yearsIncluded: false, years: '' });
    }
  }

  function handleYearsInput(val: string) {
    setYearsInput(val);
    update({ years: val, yearsIncluded: true });
  }

  return (
    <StageShell
      eyebrow="Creator &amp; Years — 1.11 / 1.12"
      title="A few finishing details"
      lede={`Optional — these appear at the end of ${name}'s tribute. Skip anything you'd rather leave out.`}
      onNext={onNext}
      onBack={onBack}
      canNext={true}
      nextLabel="Continue"
    >
      {/* Section 1: Creator name */}
      <FieldGroup
        label="Your name (optional)"
        hint="appears as 'Created by…'"
      >
        <input
          value={creatorName}
          onChange={e => handleCreatorChange(e.target.value)}
          placeholder="e.g. The Johnson family"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 15,
            padding: '12px 16px',
            border: `1px solid ${PALETTE.parchmentLight}`,
            borderRadius: 4,
            background: PALETTE.boneSoft,
            color: PALETTE.espresso,
            width: '100%',
            boxSizing: 'border-box',
            outline: 'none',
            transition: 'border-color 180ms ease',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = PALETTE.brass; }}
          onBlur={e => { e.currentTarget.style.borderColor = PALETTE.parchmentLight; }}
        />
        <Sans style={{ fontSize: 12, color: PALETTE.mute, marginTop: 8, fontStyle: 'italic' }}>
          Leaving this blank is completely fine.
        </Sans>
      </FieldGroup>

      {/* Section 2: Years */}
      <FieldGroup label={`The years ${name} was with you`}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <Pill
            active={yearsPill === 'provide'}
            onClick={() => selectYearsPill('provide')}
          >
            I&apos;ll provide them
          </Pill>
          <Pill
            active={yearsPill === 'rather_not'}
            onClick={() => selectYearsPill('rather_not')}
          >
            I&apos;d rather not
          </Pill>
          <Pill
            active={yearsPill === 'skip'}
            onClick={() => selectYearsPill('skip')}
          >
            Skip
          </Pill>
        </div>

        {yearsPill === 'provide' && (
          <div style={{ marginTop: 4 }}>
            <input
              value={yearsInput}
              onChange={e => handleYearsInput(e.target.value)}
              placeholder="e.g. 2015 – 2025"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 15,
                padding: '12px 16px',
                border: `1px solid ${PALETTE.parchmentLight}`,
                borderRadius: 4,
                background: PALETTE.boneSoft,
                color: PALETTE.espresso,
                width: '100%',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border-color 180ms ease',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = PALETTE.brass; }}
              onBlur={e => { e.currentTarget.style.borderColor = PALETTE.parchmentLight; }}
            />
            <Sans style={{ fontSize: 12, color: PALETTE.mute, marginTop: 8, fontStyle: 'italic' }}>
              Any format is fine — just the years, or a full range like &ldquo;2015 – 2025&rdquo;.
            </Sans>
          </div>
        )}

        {yearsPill === null && (
          <Sans style={{ fontSize: 12, color: PALETTE.mute, fontStyle: 'italic' }}>
            These can be shown as a quiet note at the close of the tribute, or left out entirely.
          </Sans>
        )}
      </FieldGroup>
    </StageShell>
  );
}
