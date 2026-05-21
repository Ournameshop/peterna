"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { PALETTE } from '../lib/palette';
import { Eyebrow, Sans, Serif, GateReview } from '../lib/primitives';
import { PetSketch } from '../art';
import { generateCharacterSheet } from '../lib/generation';
import { useBuilder } from '../state';
import type { StageProps } from '../state';

const REFINE_OPTIONS = [
  { id: 'ears', label: 'Ears' },
  { id: 'eyes', label: 'Eyes' },
  { id: 'face_shape', label: 'Face shape' },
  { id: 'fur', label: 'Fur' },
  { id: 'proportions', label: 'Proportions' },
  { id: 'expression', label: 'Expression' },
  { id: 'other', label: 'Other' },
];

const GATE_OPTIONS = [
  { id: 'yes', label: 'Yes, that’s them', tone: 'primary' as const },
  { id: 'close', label: 'Close, but something’s off' },
  { id: 'retry', label: 'Try again from scratch' },
  { id: 'photos', label: 'Let me add more photos' },
];

export default function CharacterSheet({ onNext, onBack, goToStep }: StageProps) {
  const { state, update } = useBuilder();
  const [generating, setGenerating] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedRefinements, setSelectedRefinements] = useState<string[]>([]);

  // Generate the 2x2 likeness reference sheet — conditioned on the user's
  // actual uploaded photos (skill Stage 2.1), so it is genuinely THIS pet.
  // Falls back to the SVG PetSketch on failure. Guarded so StrictMode's
  // double-invoke can't double-spend.
  async function runGeneration(refinements: string[] = []) {
    setGenerating(true);
    const url = await generateCharacterSheet(
      state.petPhotos,
      state.petName || 'your pet',
      state.petProfile,
      state.gateNotes.characterSheet, // free-text from the corrections box
      refinements,                    // "something's off" chips, passed explicitly
    );
    update({ characterSheetUrl: url });
    setGenerating(false);
  }

  const ranRef = useRef(false);
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    if (state.characterSheetUrl) {
      setGenerating(false);
      return;
    }
    runGeneration();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reroll(refinements: string[] = []) {
    setSelected(null);
    setSelectedRefinements([]);
    update({ characterSheetUrl: null });
    runGeneration(refinements);
  }

  function handleSelect(id: string) {
    setSelected(id);
    if (id === 'yes') {
      update({ characterSheetApproved: true });
      onNext();
    } else if (id === 'retry') {
      reroll();
    } else if (id === 'photos') {
      goToStep('photos');
    }
    // 'close' stays on this screen to show refinements
  }

  function toggleRefinement(id: string) {
    setSelectedRefinements(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  }

  function applyRefinements() {
    update({ characterSheetRefinements: selectedRefinements });
    reroll(selectedRefinements);
  }

  const petName = state.petName || 'your pet';
  const species = state.petProfile?.species || 'dog';
  const profile = state.petProfile;

  const observedText = profile
    ? `${petName} looks like a ${profile.coatDescription.toLowerCase()} ${profile.species.toLowerCase()} — ${profile.ageRange.replace('_', ' ')}, gentle eyes, soft soulful presence.`
    : `${petName} has been rendered across four reference views — front, profile, full body, and a soft upward glance.`;

  return (
    <GateReview
      eyebrow="Likeness · Gate 1"
      title={<>Does this look like <em>{petName}</em>?</>}
      lede="We render four reference views to lock in their likeness before anything else is made. Take as long as you need — this part has to feel right."
      options={generating ? [] : GATE_OPTIONS}
      onSelect={handleSelect}
      selected={selected}
      correctionLabel="Anything else you'd like us to know?"
      correctionValue={state.gateNotes.characterSheet}
      onCorrectionChange={v => update({ gateNotes: { ...state.gateNotes, characterSheet: v } })}
      onBack={onBack}
    >
      <div
        style={{
          aspectRatio: '1',
          maxWidth: 520,
          margin: '0 auto',
          background: PALETTE.boneSoft,
          border: `1px solid ${PALETTE.parchmentLight}`,
          borderRadius: 4,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {generating ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <Loader2 size={24} color={PALETTE.brass} style={{ animation: 'spin 1.2s linear infinite' }} />
            <Sans style={{ fontSize: 12, color: PALETTE.mute, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              rendering {petName}…
            </Sans>
          </div>
        ) : state.characterSheetUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={state.characterSheetUrl}
            alt={`${petName} — character reference sheet`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <>
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 55%, ${PALETTE.parchment}, ${PALETTE.boneSoft})` }} />
            <PetSketch size={160} color={PALETTE.espresso} species={species} />
          </>
        )}
      </div>

      {!generating && (
        <>
          <div style={{ marginTop: 28, padding: '20px 22px', background: PALETTE.boneSoft, border: `1px solid ${PALETTE.parchmentLight}`, borderRadius: 4 }}>
            <Eyebrow>What we observed</Eyebrow>
            <Serif italic style={{ fontSize: 18, color: PALETTE.espressoSoft, marginTop: 8, lineHeight: 1.5 }}>
              {observedText}
            </Serif>
            {profile && (
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                {[
                  `Species: ${profile.species}`,
                  `Breed: ${profile.breedGuess}`,
                  `Coat: ${profile.coatDescription}`,
                  `Age: ${profile.ageRange.replace('_', ' ')}`,
                ].map(chip => (
                  <Sans key={chip} style={{
                    fontSize: 12, padding: '6px 12px', background: 'white',
                    border: `1px solid ${PALETTE.parchment}`, borderRadius: 999,
                    color: PALETTE.espressoSoft, display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}>
                    {chip}
                  </Sans>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: 20, display: 'inline-flex', alignItems: 'center' }}>
            <button
              onClick={() => reroll()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'transparent', border: 'none', color: PALETTE.brassDeep,
                fontFamily: 'Inter, sans-serif', fontSize: 13, cursor: 'pointer',
                textDecoration: 'underline', textUnderlineOffset: 4,
              }}
            >
              <RotateCcw size={13} /> Render again
            </button>
          </div>

          {selected === 'close' && (
            <div style={{ marginTop: 24, padding: '20px 22px', background: PALETTE.boneSoft, border: `1px solid ${PALETTE.parchmentLight}`, borderRadius: 4 }}>
              <Serif style={{ fontSize: 16, color: PALETTE.espresso, marginBottom: 14 }}>
                What would you like us to adjust?
              </Serif>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {REFINE_OPTIONS.map(opt => {
                  const active = selectedRefinements.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => toggleRefinement(opt.id)}
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: 13,
                        padding: '8px 16px',
                        border: `1px solid ${active ? PALETTE.espresso : PALETTE.parchment}`,
                        background: active ? PALETTE.espresso : 'transparent',
                        color: active ? PALETTE.bone : PALETTE.espresso,
                        borderRadius: 999,
                        cursor: 'pointer',
                        transition: 'all 180ms ease',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={applyRefinements}
                disabled={selectedRefinements.length === 0}
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 13,
                  padding: '10px 20px',
                  border: 'none',
                  background: selectedRefinements.length === 0 ? PALETTE.parchmentLight : PALETTE.espresso,
                  color: selectedRefinements.length === 0 ? PALETTE.mute : PALETTE.bone,
                  borderRadius: 2,
                  cursor: selectedRefinements.length === 0 ? 'not-allowed' : 'pointer',
                  transition: 'all 200ms ease',
                }}
              >
                Re-render with adjustments
              </button>
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </GateReview>
  );
}
