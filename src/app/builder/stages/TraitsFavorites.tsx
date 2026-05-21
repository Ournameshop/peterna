"use client";

import React, { useState } from 'react';
import { PALETTE } from '../lib/palette';
import { Sans, StageShell, FieldGroup } from '../lib/primitives';
import { useBuilder } from '../state';
import { personalityTraits, favoriteThings } from '@/lib/peternal-library';
import type { StageProps } from './types';

const CAP = 3;

export default function TraitsFavorites({ onNext, onBack }: StageProps) {
  const { state, update } = useBuilder();
  const [traits, setTraits] = useState<string[]>(state.traits);
  const [favorites, setFavorites] = useState<string[]>(state.favorites);

  const name = state.petName || 'your pet';

  function toggleTrait(id: string) {
    let next: string[];
    if (traits.includes(id)) {
      next = traits.filter(t => t !== id);
    } else if (traits.length < CAP) {
      next = [...traits, id];
    } else {
      return;
    }
    setTraits(next);
    update({ traits: next });
  }

  function toggleFavorite(id: string) {
    let next: string[];
    if (favorites.includes(id)) {
      next = favorites.filter(f => f !== id);
    } else if (favorites.length < CAP) {
      next = [...favorites, id];
    } else {
      return;
    }
    setFavorites(next);
    update({ favorites: next });
  }

  return (
    <StageShell
      eyebrow="Personality — 1.9 / 1.10"
      title={`Who was ${name}?`}
      lede="Pick the ones that feel most like them. No wrong answers — and no pressure to choose."
      onNext={onNext}
      onBack={onBack}
      canNext={true}
      nextLabel="Continue"
    >
      {/* Section 1: Personality traits */}
      <FieldGroup
        label="Their personality"
        hint={traits.length === 0 ? 'up to 3' : `${traits.length} / ${CAP} selected`}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {personalityTraits.map(t => {
            const active = traits.includes(t.id);
            const disabled = !active && traits.length >= CAP;
            return (
              <button
                key={t.id}
                onClick={() => toggleTrait(t.id)}
                disabled={disabled}
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 13,
                  padding: '8px 16px',
                  border: `1px solid ${active ? PALETTE.espresso : PALETTE.parchment}`,
                  background: active ? PALETTE.espresso : 'transparent',
                  color: active ? PALETTE.bone : (disabled ? PALETTE.parchment : PALETTE.espresso),
                  borderRadius: 999,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  transition: 'all 180ms ease',
                  letterSpacing: '0.01em',
                  opacity: disabled ? 0.45 : 1,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {traits.length === 0 && (
          <Sans style={{ fontSize: 12, color: PALETTE.mute, marginTop: 12, fontStyle: 'italic' }}>
            These shape the tone of the tribute — choose the ones that feel truest.
          </Sans>
        )}
        {traits.length >= CAP && (
          <Sans style={{ fontSize: 12, color: PALETTE.brass, marginTop: 12 }}>
            3 chosen — you can swap them any time before continuing.
          </Sans>
        )}
      </FieldGroup>

      {/* Section 2: Favorite things */}
      <FieldGroup
        label="Their favorite things"
        hint={favorites.length === 0 ? 'up to 3' : `${favorites.length} / ${CAP} selected`}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {favoriteThings.map(f => {
            const active = favorites.includes(f.id);
            const disabled = !active && favorites.length >= CAP;
            return (
              <button
                key={f.id}
                onClick={() => toggleFavorite(f.id)}
                disabled={disabled}
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 13,
                  padding: '8px 16px',
                  border: `1px solid ${active ? PALETTE.espresso : PALETTE.parchment}`,
                  background: active ? PALETTE.espresso : 'transparent',
                  color: active ? PALETTE.bone : (disabled ? PALETTE.parchment : PALETTE.espresso),
                  borderRadius: 999,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  transition: 'all 180ms ease',
                  letterSpacing: '0.01em',
                  opacity: disabled ? 0.45 : 1,
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {favorites.length === 0 && (
          <Sans style={{ fontSize: 12, color: PALETTE.mute, marginTop: 12, fontStyle: 'italic' }}>
            Favorite things become scenes in the tribute — the more specific, the more personal.
          </Sans>
        )}
        {favorites.length >= CAP && (
          <Sans style={{ fontSize: 12, color: PALETTE.brass, marginTop: 12 }}>
            3 chosen — these will become moments in {name}&apos;s story.
          </Sans>
        )}
      </FieldGroup>
    </StageShell>
  );
}
