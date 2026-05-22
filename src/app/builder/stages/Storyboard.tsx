"use client";

import React, { useEffect, useRef, useState } from 'react';
import { PALETTE } from '../lib/palette';
import { Serif, Sans, GateReview } from '../lib/primitives';
import { generateStoryboardFrame } from '../lib/generation';
import { useBuilder, usePreviewMode } from '../state';
import type { Beat, WordsState, Gender } from '../state';
import { BeatScene } from '../art';
import type { StageProps } from './types';
import { openingArchetypes, closingArchetypes } from '@/lib/peternal-library';
import { resolveText } from '@/lib/peternal-resolvers';

function finalBeatCaption(beat: Beat, words: WordsState, resolveCtx: { gender: Gender; petName: string }): string {
  if (beat.archetype === 'open') {
    if (words.opening === 'custom') {
      return `${words.openingCustom[0]}\n${words.openingCustom[1]}`.trim();
    }
    return resolveText(
      openingArchetypes.find(a => a.id === words.opening)?.template ?? openingArchetypes[0].template,
      resolveCtx,
    );
  }
  if (beat.archetype === 'close') {
    if (words.closing === 'custom') {
      return words.closingCustom;
    }
    return resolveText(
      closingArchetypes.find(a => a.id === words.closing)?.template
        ?? closingArchetypes.find(a => a.isDefault)?.template
        ?? closingArchetypes[0].template,
      resolveCtx,
    );
  }
  const captionEntry = words.captions.find(c => c.beatIndex === beat.index);
  if (captionEntry) return captionEntry.text;
  return beat.caption;
}

export default function Storyboard({ onNext, onBack }: StageProps) {
  const { state, update } = useBuilder();
  const previewMode = usePreviewMode();
  const [generating, setGenerating] = useState(false);
  // Init from the persisted approval flag — not from beatSheet length (which is
  // always populated by the time Storyboard is reached). This way the batch
  // spinner fires on the first visit and is skipped when returning post-approval.
  const [generated, setGenerated] = useState(state.storyboardApproved);
  const [rerollTarget, setRerollTarget] = useState<'single' | 'multi' | null>(null);
  const [rerollBeatIdx, setRerollBeatIdx] = useState<number | null>(null); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [rerollSpinning, setRerollSpinning] = useState(false);
  const [action, setAction] = useState<string | null>(null); // eslint-disable-line @typescript-eslint/no-unused-vars

  const beats = state.beatSheet;
  const themeGradient = ''; // BeatScene picks its own fallback

  // Generate one fal.ai frame per beat. Skipped if frames already exist (return
  // visit) or the gate was already approved. Guarded against StrictMode double-fire.
  const ranRef = useRef(false);
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    const hasImages = Object.keys(state.storyboardImages).length > 0;
    if (previewMode || generated || hasImages || beats.length === 0) {
      setGenerated(true);
      return;
    }
    (async () => {
      setGenerating(true);
      const resolveCtx = { gender: state.gender ?? 'neutral', petName: state.petName || 'your pet' };
      const petIdentity = state.petProfile ? {
        species: state.petProfile.species,
        breedGuess: state.petProfile.breedGuess,
        coatDescription: state.petProfile.coatDescription,
        ageRange: state.petProfile.ageRange,
        bodyType: state.petProfile.bodyType,
      } : undefined;
      const entries = await Promise.all(
        beats.map(async (beat) => {
          const resolvedBeat = { ...beat, caption: finalBeatCaption(beat, state.words, resolveCtx) };
          const url = await generateStoryboardFrame(
            resolvedBeat,
            state.characterSheetUrl,
            state.petName || 'your pet',
            state.theme,
            state.style,
            state.format,
            state.aspectRatio,
            state.captionContainer,
            undefined,
            undefined,
            petIdentity,
          );
          return [beat.index, url] as const;
        }),
      );
      const record: Record<number, string> = {};
      for (const [idx, url] of entries) if (url) record[idx] = url;
      update({ storyboardImages: record });
      setGenerating(false);
      setGenerated(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleApproval(id: string) {
    setAction(id);
    if (id === 'approve') {
      update({ storyboardApproved: true });
      onNext();
    } else if (id === 'rerender_single') {
      setRerollTarget('single');
    } else if (id === 'rerender_multi') {
      setRerollTarget('multi');
    }
  }

  async function spinFrame(beatIdx: number) {
    setRerollSpinning(true);
    setRerollTarget(null);
    setRerollBeatIdx(null);
    setAction(null);
    update({ storyboardRerollRequests: [...state.storyboardRerollRequests, beatIdx] });
    const beat = beats.find(b => b.index === beatIdx);
    if (beat) {
      const resolveCtx = { gender: state.gender ?? 'neutral', petName: state.petName || 'your pet' };
      const resolvedBeat = { ...beat, caption: finalBeatCaption(beat, state.words, resolveCtx) };
      const petIdentity = state.petProfile ? {
        species: state.petProfile.species,
        breedGuess: state.petProfile.breedGuess,
        coatDescription: state.petProfile.coatDescription,
        ageRange: state.petProfile.ageRange,
        bodyType: state.petProfile.bodyType,
      } : undefined;
      const url = await generateStoryboardFrame(
        resolvedBeat,
        state.characterSheetUrl,
        state.petName || 'your pet',
        state.theme,
        state.style,
        state.format,
        state.aspectRatio,
        state.captionContainer,
        state.gateNotes.storyboard, // user's notes from the corrections box → into the re-render
        state.storyboardImages[beatIdx], // the frame being re-rendered — edited in place when a note is given
        petIdentity,
      );
      if (url) update({ storyboardImages: { ...state.storyboardImages, [beatIdx]: url } });
    }
    setRerollSpinning(false);
  }

  const approvalOptions = [
    { id: 'approve', label: 'All good — move to Card Preview', tone: 'primary' as const },
    { id: 'rerender_single', label: 'Re-render a frame' },
    { id: 'rerender_multi', label: 'Re-render multiple' },
  ];

  const aspectRatio = state.aspectRatio === '9:16' ? '9 / 16'
    : state.aspectRatio === '16:9' ? '16 / 9'
    : '1';

  const petName = state.petName || 'your pet';

  const colCount = state.aspectRatio === '9:16' ? 3
    : state.aspectRatio === '16:9' ? 2
    : 3;

  return (
    <GateReview
      eyebrow="Gate 2 — Storyboard"
      title={`${petName}'s storyboard`}
      lede={`${beats.length} frames, one per beat. Take your time — every frame can be re-rendered.`}
      options={generating ? [] : approvalOptions}
      onSelect={handleApproval}
      selected={null}
      correctionLabel="Notes on specific frames (optional)"
      correctionValue={state.gateNotes.storyboard}
      onCorrectionChange={v => update({ gateNotes: { ...state.gateNotes, storyboard: v } })}
      onBack={onBack}
    >
      {generating && (
        <div style={{ padding: '48px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${PALETTE.parchmentLight}`, borderTopColor: PALETTE.brass, borderRadius: '50%', animation: 'spin 0.9s linear infinite' }}/>
          <Sans style={{ fontSize: 13, color: PALETTE.mute }}>Composing all {beats.length} frames…</Sans>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!generating && generated && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colCount}, 1fr)`, gap: 12, marginBottom: 28 }}>
          {beats.map((beat, i) => {
            const isRerolling = rerollSpinning && state.storyboardRerollRequests[state.storyboardRerollRequests.length - 1] === beat.index;
            return (
              <div key={beat.index} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ position: 'relative', borderRadius: 4, overflow: 'hidden', border: `1px solid ${PALETTE.parchmentLight}` }}>
                  {isRerolling ? (
                    <div style={{ aspectRatio, background: PALETTE.boneSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 24, height: 24, border: `2px solid ${PALETTE.parchmentLight}`, borderTopColor: PALETTE.brass, borderRadius: '50%', animation: 'spin 0.9s linear infinite' }}/>
                    </div>
                  ) : state.storyboardImages[beat.index] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={state.storyboardImages[beat.index]}
                      alt={beat.name}
                      style={{ display: 'block', width: '100%', aspectRatio, objectFit: 'cover' }}
                    />
                  ) : (
                    <BeatScene
                      beatIndex={beat.index}
                      themeGradient={themeGradient}
                      aspect={state.aspectRatio === 'all_three' ? '1:1' : state.aspectRatio}
                      species={state.petProfile?.species ?? 'dog'}
                    />
                  )}
                  {(rerollTarget === 'single' || rerollTarget === 'multi') && (
                    <button
                      onClick={() => spinFrame(beat.index)}
                      style={{
                        position: 'absolute', inset: 0, background: 'rgba(42,33,27,0.45)',
                        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Sans style={{ fontSize: 12, color: 'white', letterSpacing: '0.06em' }}>Re-render</Sans>
                    </button>
                  )}
                </div>
                <div>
                  <Sans style={{ fontSize: 10, color: PALETTE.mute, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Beat {i + 1} · {beat.archetype}
                  </Sans>
                  <Serif italic style={{ fontSize: 13, color: PALETTE.espresso, lineHeight: 1.35 }}>{beat.name}</Serif>
                  {beat.caption && (
                    <Serif italic style={{ fontSize: 12, color: PALETTE.mute, marginTop: 2 }}>{beat.caption}</Serif>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GateReview>
  );
}
