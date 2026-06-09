"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Maximize2, X } from 'lucide-react';
import { PALETTE } from '../lib/palette';
import { Serif, Sans, GateReview } from '../lib/primitives';
import { useBuilder, activeReferenceSheet } from '../state';
import { CardArt } from '../art';
import { generateCardImage, generateCaptionOverlay } from '../lib/generation';
import { usePreviewMode } from '../state';
import type { StageProps } from './types';
import type { ContainerId } from '../state';
import { openingArchetypes, closingArchetypes } from '@/lib/peternal-library';
import { resolveText } from '@/lib/peternal-resolvers';

export default function CardPreview({ onNext, onBack, goToStep }: StageProps) {
  const { state, update } = useBuilder();
  const previewMode = usePreviewMode();
  const [generating, setGenerating] = useState(false);
  const [zoomed, setZoomed] = useState<number | null>(null);

  const petName = state.petName || 'your pet';
  const containerId: ContainerId = state.captionContainer ?? 'cinematic_lower_third';
  const artStyle = state.style ?? 'cinematic_realism';
  const aspectRatio = state.aspectRatio === 'all_three' ? '1:1' : (state.aspectRatio ?? '9:16');
  const gender = state.gender ?? 'neutral';
  const resolveCtx = { gender, petName };

  const openingText = state.words.opening === 'custom'
    ? `${state.words.openingCustom[0]}\n${state.words.openingCustom[1]}`.trim()
    : resolveText(
        openingArchetypes.find(a => a.id === state.words.opening)?.template
          ?? openingArchetypes[0].template,
        resolveCtx
      );

  const closingText = state.words.closing === 'custom'
    ? state.words.closingCustom
    : resolveText(
        closingArchetypes.find(a => a.id === state.words.closing)?.template
          ?? closingArchetypes.find(a => a.isDefault)?.template
          ?? closingArchetypes[0].template,
        resolveCtx
      );

  const sampleCaption = state.beatSheet.length > 0
    ? (state.beatSheet.find(b => b.archetype === 'memory')?.caption || state.beatSheet[1]?.caption || state.beatSheet[0]?.caption || '')
    : `In every sunbeam, in every quiet moment.`;

  async function runGeneration(userNote?: string) {
    setGenerating(true);

    // Per-beat caption cards: already capped at 3 by TheWords.tsx.
    const captionEntries = state.words.captions;

    // Honor the user's own reference sheet when they built one (was a bug: cards
    // always used the AI characterSheetUrl, ignoring the user's selection).
    const referenceSheetUrl = activeReferenceSheet(state);

    // Background image priority per card type (reuses already-generated assets, no new AI calls).
    const lastBeatIndex = state.beatSheet.length > 0 ? state.beatSheet.length - 1 : 0;
    const openingBg: string | undefined =
      state.storyboardImages[0] ?? state.combinationPreviewUrl ?? referenceSheetUrl ?? undefined;
    const closingBg: string | undefined =
      state.storyboardImages[lastBeatIndex] ?? state.combinationPreviewUrl ?? referenceSheetUrl ?? undefined;
    const memoryBeatIndex = state.beatSheet.findIndex(b => b.archetype === 'memory');
    const sampleCaptionBg: string | undefined =
      (memoryBeatIndex >= 0 ? state.storyboardImages[memoryBeatIndex] : null)
        ?? state.storyboardImages[1]
        ?? state.combinationPreviewUrl
        ?? referenceSheetUrl
        ?? undefined;

    // Pet identity for the AI card prompt (skill variable-reference, Group A).
    const pet = {
      name: state.petName,
      species: state.petProfile?.species ?? 'pet',
      breedGuess: state.petProfile?.breedGuess,
      coatDescription: state.petProfile?.coatDescription,
      ageRange: state.petProfile?.ageRange,
      bodyType: state.petProfile?.bodyType,
    };
    const sampleCaptionHint = (memoryBeatIndex >= 0 ? state.beatSheet[memoryBeatIndex] : state.beatSheet[1])?.visual;

    const [opening, closing, caption, ...rest] = await Promise.all([
      generateCardImage({
        kind: 'opening',
        text: openingText,
        characterSheet: referenceSheetUrl,
        containerId,
        themeId: state.theme,
        styleId: state.style,
        formatId: state.format,
        aspect: state.aspectRatio,
        userNote,
        pet,
        backgroundImageUrl: openingBg,
      }),
      generateCardImage({
        kind: 'closing',
        text: closingText,
        characterSheet: referenceSheetUrl,
        containerId,
        themeId: state.theme,
        styleId: state.style,
        formatId: state.format,
        aspect: state.aspectRatio,
        userNote,
        pet,
        backgroundImageUrl: closingBg,
      }),
      generateCardImage({
        kind: 'caption',
        text: sampleCaption,
        characterSheet: referenceSheetUrl,
        containerId,
        themeId: state.theme,
        styleId: state.style,
        formatId: state.format,
        aspect: state.aspectRatio,
        userNote,
        pet,
        sceneHint: sampleCaptionHint,
        backgroundImageUrl: sampleCaptionBg,
      }),
      // Per-beat full-frame caption card images
      ...captionEntries.map((entry) =>
        generateCardImage({
          kind: 'caption',
          text: entry.text,
          characterSheet: referenceSheetUrl,
          containerId,
          themeId: state.theme,
          styleId: state.style,
          formatId: state.format,
          aspect: state.aspectRatio,
          userNote,
          pet,
          sceneHint: state.beatSheet.find((b) => b.index === entry.beatIndex)?.visual,
          backgroundImageUrl: state.storyboardImages[entry.beatIndex] ?? state.combinationPreviewUrl ?? undefined,
        })
      ),
      // Per-beat caption_overlay transparent PNGs (P1)
      ...captionEntries.map((entry) =>
        generateCaptionOverlay({
          text: entry.text,
          containerId,
          styleId: state.style,
          aspect: state.aspectRatio,
        })
      ),
    ]);

    const captionCardResults = rest.slice(0, captionEntries.length);
    const captionOverlayResults = rest.slice(captionEntries.length);

    // Build captionCardImages record: beatIndex -> URL (skip nulls).
    const captionCardImages: Record<number, string> = {};
    captionEntries.forEach((entry, idx) => {
      const url = captionCardResults[idx];
      if (url) captionCardImages[entry.beatIndex] = url;
    });

    // Build captionOverlayImages record: beatIndex -> URL (skip nulls).
    const captionOverlayImages: Record<number, string> = {};
    captionEntries.forEach((entry, idx) => {
      const url = captionOverlayResults[idx];
      if (url) captionOverlayImages[entry.beatIndex] = url;
    });

    update({ cardPreviewImages: { opening, closing, caption }, captionCardImages, captionOverlayImages, assembledVideoUrl: null });
    setGenerating(false);
  }

  const ranRef = useRef(false);
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    const imgs = state.cardPreviewImages;
    if (previewMode || imgs.opening !== null || imgs.closing !== null || imgs.caption !== null) return;
    runGeneration();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close the full-view modal on Escape.
  useEffect(() => {
    if (zoomed === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomed(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoomed]);

  function handleApproval(id: string) {
    if (id === 'approve') {
      update({
        cardText: { opening: openingText, closing: closingText },
        typographyLocked: containerId,
        cardPreviewApproved: true,
      });
      onNext();
    } else if (id === 'change_wording') {
      goToStep('words');
    } else if (id === 'rerender') {
      update({ cardPreviewImages: { opening: null, closing: null, caption: null } });
      runGeneration(state.gateNotes.cardPreview || undefined);
    } else if (id === 'switch_style') {
      goToStep(state.pickType === 'curated' ? 'style_confirm' : 'style');
    }
  }

  const approvalOptions = [
    { id: 'approve', label: 'Looks great — onward', tone: 'primary' as const },
    { id: 'change_wording', label: 'Change the wording' },
    { id: 'rerender', label: 'Refresh preview' },
    { id: 'switch_style', label: 'Switch art style' },
  ];

  const cards = [
    { type: 'opening' as const, text: openingText, label: 'Opening title card', url: state.cardPreviewImages.opening },
    { type: 'caption' as const, text: sampleCaption, label: 'Sample caption card', url: state.cardPreviewImages.caption },
    { type: 'closing' as const, text: closingText, label: 'Closing card', url: state.cardPreviewImages.closing },
  ];

  return (
    <GateReview
      eyebrow="Card Preview"
      title={`Here's how the title cards and a sample caption look in ${petName}'s world.`}
      lede={`Three simulated cards using your chosen container and the words you've set. This is how text will appear throughout the tribute.`}
      options={approvalOptions}
      onSelect={handleApproval}
      selected={null}
      correctionLabel="Anything off about the type, the spacing, the words, or how they sit in the scene?"
      correctionValue={state.gateNotes.cardPreview}
      onCorrectionChange={(v) => update({ gateNotes: { ...state.gateNotes, cardPreview: v } })}
      onBack={onBack}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18, alignItems: 'start', marginBottom: 32 }}>
        {cards.map((card, idx) => {
          const cssAspect = aspectRatio === '16:9' ? '16 / 9' : aspectRatio === '1:1' ? '1 / 1' : '9 / 16';
          return (
            <div key={card.type} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div
                onClick={() => { if (!generating) setZoomed(idx); }}
                style={{ border: `1px solid ${PALETTE.parchmentLight}`, borderRadius: 6, overflow: 'hidden', position: 'relative', cursor: generating ? 'default' : 'pointer', width: '100%', aspectRatio: cssAspect, background: PALETTE.boneSoft }}
              >
                {generating ? (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <Loader2 size={22} color={PALETTE.brass} style={{ animation: 'spin 1.2s linear infinite' }} />
                    <Sans style={{ fontSize: 11, color: PALETTE.mute, letterSpacing: '0.1em', textTransform: 'uppercase' }}>rendering…</Sans>
                  </div>
                ) : card.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.url}
                    alt={card.label}
                    style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ position: 'absolute', inset: 0 }}>
                    <CardArt
                      containerId={containerId}
                      text={card.text}
                      aspectRatio={aspectRatio}
                      artStyle={artStyle}
                      cardType={card.type}
                    />
                  </div>
                )}
                {!generating && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      background: 'rgba(42,33,27,0.55)',
                      borderRadius: 4,
                      padding: '5px 6px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Maximize2 size={14} color={PALETTE.bone} />
                  </div>
                )}
              </div>
              <div>
                <Sans style={{ fontSize: 11, color: PALETTE.mute, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {card.label}
                </Sans>
                <Serif italic style={{ fontSize: 15, color: PALETTE.espresso, marginTop: 3, lineHeight: 1.4 }}>
                  {card.text}
                </Serif>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ background: PALETTE.boneSoft, border: `1px solid ${PALETTE.parchmentLight}`, borderRadius: 4, padding: '14px 18px', marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <Sans style={{ fontSize: 10, color: PALETTE.mute, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 3 }}>Container</Sans>
            <Serif italic style={{ fontSize: 14, color: PALETTE.espresso }}>{containerId.replace(/_/g, ' ')}</Serif>
          </div>
          <div>
            <Sans style={{ fontSize: 10, color: PALETTE.mute, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 3 }}>Art Style</Sans>
            <Serif italic style={{ fontSize: 14, color: PALETTE.espresso }}>{artStyle.replace(/_/g, ' ')}</Serif>
          </div>
          <div>
            <Sans style={{ fontSize: 10, color: PALETTE.mute, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 3 }}>Aspect</Sans>
            <Serif italic style={{ fontSize: 14, color: PALETTE.espresso }}>{aspectRatio}</Serif>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Full-view modal */}
      {zoomed !== null && (() => {
        const card = cards[zoomed];
        if (!card) return null;
        return (
          <div
            onClick={() => setZoomed(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.85)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <button
              onClick={() => setZoomed(null)}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: 18,
                right: 18,
                background: 'rgba(255,255,255,0.12)',
                border: 'none',
                borderRadius: '50%',
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={18} color="white" />
            </button>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: '92vw', maxHeight: '92vh' }}
            >
              {card.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.url}
                  alt={card.label}
                  style={{ display: 'block', maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 6 }}
                />
              ) : (
                <div style={{ width: aspectRatio === '9:16' ? 'min(46vh, 90vw)' : 'min(86vw, 600px)' }}>
                  <CardArt
                    containerId={containerId}
                    text={card.text}
                    aspectRatio={aspectRatio}
                    artStyle={artStyle}
                    cardType={card.type}
                  />
                </div>
              )}
              <div style={{ textAlign: 'center' }}>
                <Sans style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {card.label}
                </Sans>
                <Serif italic style={{ fontSize: 16, color: 'white', marginTop: 4, maxWidth: 460 }}>
                  {card.text}
                </Serif>
              </div>
            </div>
          </div>
        );
      })()}
    </GateReview>
  );
}
