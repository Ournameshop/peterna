"use client";

import React, { useEffect, useRef, useState } from 'react';
import { PALETTE } from '../lib/palette';
import { Serif, Sans, Eyebrow, StageShell, EditChip, FieldGroup } from '../lib/primitives';
import { analyzePetPhoto } from '../lib/generation';
import { useBuilder } from '../state';
import type { StageProps } from './types';
import type { PetProfile } from '../state';
import type { PetPhoto } from '../state';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildSimulatedProfile(_petPhotos: PetPhoto[], _petName: string): PetProfile {
  return {
    species: 'Dog',
    speciesConfidence: 'high',
    breedGuess: 'Mixed breed',
    breedConfidence: 'medium',
    coatDescription: 'warm tan with a cream chest',
    coatConfidence: 'high',
    ageRange: 'adult',
    ageConfidence: 'medium',
    bodyType: 'medium',
    observedSetting: 'indoors in warm light',
    observedMoment: 'at rest, gaze lifted',
    visionFailed: false,
  };
}

const AGE_LABELS: Record<PetProfile['ageRange'], string> = {
  puppy_kitten: 'Puppy / Kitten',
  young_adult: 'Young Adult',
  adult: 'Adult',
  senior: 'Senior',
};

export default function VisionConfirm({ onNext, onBack }: StageProps) {
  const { state, update } = useBuilder();
  const [scanning, setScanning] = useState(!state.petProfile);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Guard so React StrictMode's double-invoke can't fire the vision call twice.
  const ranRef = useRef(false);
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    if (state.petProfile) {
      setScanning(false);
      return;
    }
    (async () => {
      const photo =
        state.petPhotos.find(p => p.file) ??
        state.petPhotos.find(p => p.url) ??
        state.petPhotos[0];
      // Real Gemini-vision analysis; falls back to an explicit-question profile on any failure.
      const analysisResult = photo ? await analyzePetPhoto(photo) : null;
      const profile: PetProfile = analysisResult ?? {
        ...buildSimulatedProfile(state.petPhotos, state.petName),
        visionFailed: true,
      };
      update({ petProfile: profile });
      setScanning(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const name = state.petName || 'your pet';
  const p = state.petProfile;

  function openEdit(field: string, current: string) {
    setEditing(field);
    setEditValue(current);
  }

  function commitEdit() {
    if (!p || !editing) return;
    update({ petProfile: { ...p, [editing]: editValue } });
    setEditing(null);
  }

  const observationParagraph = p
    ? `In your photos, I can see ${p.species.toLowerCase()} with ${p.coatDescription}${p.bodyType ? `, ${p.bodyType} in build` : ''}. ${p.observedSetting ? `${name} appears ${p.observedSetting}` : ''}, ${p.observedMoment ? p.observedMoment : 'looking peaceful and at ease'}.`
    : '';

  const canNext = !scanning;

  if (scanning) {
    return (
      <section style={{ paddingTop: 48 }}>
        <Eyebrow>Looking at your photos</Eyebrow>
        <Serif as="h2" italic style={{ fontSize: 'clamp(28px, 4vw, 44px)', lineHeight: 1.1, marginTop: 14, marginBottom: 24, color: PALETTE.espresso }}>
          Just a moment…
        </Serif>
        <Sans style={{ fontSize: 16, color: PALETTE.mute, lineHeight: 1.5 }}>
          Looking at your photos of {name}
        </Sans>
        <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: `2px solid ${PALETTE.parchmentLight}`,
            borderTopColor: PALETTE.brass,
            animation: 'spin 0.9s linear infinite',
          }} />
          <Sans style={{ fontSize: 13, color: PALETTE.mute }}>Recognising {name}…</Sans>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </section>
    );
  }

  if (!p) return null;

  if (p.visionFailed) {
    return (
      <StageShell
        eyebrow="About them"
        title={`Tell us about ${name}`}
        lede="We couldn't read your photos clearly. Let's fill in a few details together."
        onNext={onNext}
        onBack={onBack}
        canNext={canNext}
        nextLabel={`Yes, that's ${name}`}
      >
        <FieldGroup label="Species">
          <input
            value={p.species}
            onChange={e => update({ petProfile: { ...p, species: e.target.value } })}
            style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, padding: '10px 14px', border: `1px solid ${PALETTE.parchmentLight}`, borderRadius: 4, background: PALETTE.boneSoft, color: PALETTE.espresso, width: '100%', boxSizing: 'border-box' }}
          />
        </FieldGroup>
        <FieldGroup label="Breed">
          <input
            value={p.breedGuess}
            onChange={e => update({ petProfile: { ...p, breedGuess: e.target.value } })}
            style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, padding: '10px 14px', border: `1px solid ${PALETTE.parchmentLight}`, borderRadius: 4, background: PALETTE.boneSoft, color: PALETTE.espresso, width: '100%', boxSizing: 'border-box' }}
          />
        </FieldGroup>
      </StageShell>
    );
  }

  return (
    <StageShell
      eyebrow="About them"
      title={`Here's what I see in your photos of ${name}:`}
      lede={observationParagraph}
      onNext={onNext}
      onBack={onBack}
      canNext={canNext}
      nextLabel={`Yes, that's ${name}`}
      secondaryAction={
        <button
          onClick={() => {
            const chipRow = document.getElementById('vision-edit-chips');
            if (chipRow) chipRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const firstChip = chipRow?.querySelector('button') as HTMLButtonElement | null;
            if (firstChip) firstChip.focus();
          }}
          style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: PALETTE.mute, background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          Let me fix something
        </button>
      }
    >
      {editing && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(42,33,27,0.35)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: PALETTE.bone, borderRadius: 6, padding: 28, width: 340, boxShadow: '0 12px 40px rgba(42,33,27,0.15)' }}>
            <Serif italic style={{ fontSize: 20, marginBottom: 16, color: PALETTE.espresso }}>
              Edit {editing.replace(/([A-Z])/g, ' $1').toLowerCase()}
            </Serif>
            <input
              autoFocus
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(null); }}
              style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, padding: '10px 14px', border: `1px solid ${PALETTE.parchmentLight}`, borderRadius: 4, background: PALETTE.boneSoft, color: PALETTE.espresso, width: '100%', boxSizing: 'border-box', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={commitEdit} style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, padding: '8px 18px', background: PALETTE.espresso, color: PALETTE.bone, border: 'none', borderRadius: 2, cursor: 'pointer' }}>Save</button>
              <button onClick={() => setEditing(null)} style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, padding: '8px 18px', background: 'transparent', color: PALETTE.mute, border: `1px solid ${PALETTE.parchmentLight}`, borderRadius: 2, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div id="vision-edit-chips" style={{ background: PALETTE.boneSoft, border: `1px solid ${PALETTE.parchmentLight}`, borderRadius: 6, padding: '24px 28px', marginBottom: 32, borderLeft: `3px solid ${PALETTE.brass}` }}>
        <Sans style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: PALETTE.mute, marginBottom: 16 }}>What I observed</Sans>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <EditChip label="Species" value={p.species} onClick={() => openEdit('species', p.species)} />
          <EditChip label="Breed" value={p.breedGuess} onClick={() => openEdit('breedGuess', p.breedGuess)} />
          <EditChip label="Coat" value={p.coatDescription} onClick={() => openEdit('coatDescription', p.coatDescription)} />
          <EditChip label="Age" value={AGE_LABELS[p.ageRange]} onClick={() => openEdit('ageRange', p.ageRange)} />
        </div>
        <Sans style={{ fontSize: 12, color: PALETTE.mute, marginTop: 14, fontStyle: 'italic' }}>
          Tap any chip to correct a detail — these shape how {name} looks in the tribute.
        </Sans>
      </div>
    </StageShell>
  );
}
