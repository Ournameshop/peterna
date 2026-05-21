"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { PALETTE } from '../lib/palette';
import { Serif, Sans, GateReview } from '../lib/primitives';
import { useBuilder } from '../state';
import { CardArt } from '../art';
import { generateCardImage } from '../lib/generation';
import type { StageProps } from './types';
import type { ContainerId } from '../state';
import { openingArchetypes, closingArchetypes } from '@/lib/peternal-library';
import { resolveText } from '@/lib/peternal-resolvers';

export default function CardPreview({ onNext, onBack, goToStep }: StageProps) {
  const { state, update } = useBuilder();
  const [generating, setGenerating] = useState(false);

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

    const [opening, closing, caption, ...captionCardResults] = await Promise.all([
      generateCardImage({
        kind: 'opening',
        text: openingText,
        characterSheet: state.characterSheetUrl,
        containerId,
        themeId: state.theme,
        styleId: state.style,
        aspect: state.aspectRatio,
        userNote,
      }),
      generateCardImage({
        kind: 'closing',
        text: closingText,
        characterSheet: state.characterSheetUrl,
        containerId,
        themeId: state.theme,
        styleId: state.style,
        aspect: state.aspectRatio,
        userNote,
      }),
      generateCardImage({
        kind: 'caption',
        text: sampleCaption,
        characterSheet: state.characterSheetUrl,
        containerId,
        themeId: state.theme,
        styleId: state.style,
        aspect: state.aspectRatio,
        userNote,
      }),
      // Per-beat caption card images alongside the sample cards.
      ...captionEntries.map((entry) =>
        generateCardImage({
          kind: 'caption',
          text: entry.text,
          characterSheet: state.characterSheetUrl,
          containerId,
          themeId: state.theme,
          styleId: state.style,
          aspect: state.aspectRatio,
          userNote,
        })
      ),
    ]);

    // Build captionCardImages record: beatIndex -> URL (skip nulls).
    const captionCardImages: Record<number, string> = {};
    captionEntries.forEach((entry, idx) => {
      const url = captionCardResults[idx];
      if (url) captionCardImages[entry.beatIndex] = url;
    });

    update({ cardPreviewImages: { opening, closing, caption }, captionCardImages, assembledVideoUrl: null });
    setGenerating(false);
  }

  const ranRef = useRef(false);
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    const imgs = state.cardPreviewImages;
    if (imgs.opening !== null || imgs.closing !== null || imgs.caption !== null) return;
    runGeneration();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    { id: 'rerender', label: 'Re-render the cards' },
    { id: 'switch_style', label: 'Switch art style' },
  ];

  const cards = [
    { type: 'opening' as const, text: openingText, label: 'Opening title card', url: state.cardPreviewImages.opening },
    { type: 'caption' as const, text: sampleCaption, label: 'Sample caption card', url: state.cardPreviewImages.caption },
    { type: 'closing' as const, text: closingText, label: 'Closing card', url: state.cardPreviewImages.closing },
  ];

  return (
    <GateReview
      eyebrow="Stage 5.6 — Card Preview"
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
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 32 }}>
        {cards.map(card => (
          <div key={card.type} style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <div style={{ border: `1px solid ${PALETTE.parchmentLight}`, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
              {generating ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  width: 200,
                  height: aspectRatio === '16:9' ? 113 : aspectRatio === '1:1' ? 200 : 356,
                  background: PALETTE.boneSoft,
                }}>
                  <Loader2 size={20} color={PALETTE.brass} style={{ animation: 'spin 1.2s linear infinite' }} />
                  <Sans style={{ fontSize: 11, color: PALETTE.mute, letterSpacing: '0.1em', textTransform: 'uppercase' }}>rendering…</Sans>
                </div>
              ) : card.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.url}
                  alt={card.label}
                  style={{
                    display: 'block',
                    width: 200,
                    height: aspectRatio === '16:9' ? 113 : aspectRatio === '1:1' ? 200 : 356,
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <CardArt
                  containerId={containerId}
                  text={card.text}
                  aspectRatio={aspectRatio}
                  artStyle={artStyle}
                  cardType={card.type}
                />
              )}
            </div>
            <div style={{ textAlign: 'center' }}>
              <Sans style={{ fontSize: 11, color: PALETTE.mute, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {card.label}
              </Sans>
              <Serif italic style={{ fontSize: 13, color: PALETTE.espresso, marginTop: 2, maxWidth: 200 }}>
                {card.text}
              </Serif>
            </div>
          </div>
        ))}
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
    </GateReview>
  );
}
