"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PALETTE } from '../lib/palette';
import { StageShell, Pill, Serif, Sans } from '../lib/primitives';
import { BeatScene } from '../art';
import { generateCombinationPreview } from '../lib/generation';
import { useBuilder, usePreviewMode } from '../state';
import type { StageProps } from '../state';
import { formats, themes, artStyles } from '@/lib/peternal-library';

export default function CombinationPreview({ onNext, onBack, goToStep }: StageProps) {
  const { state, update } = useBuilder();
  const previewMode = usePreviewMode();
  const [generating, setGenerating] = useState(!state.combinationPreviewUrl);

  const petName = state.petName || 'them';
  const formatObj = formats.find(f => f.id === state.format);
  const themeObj = themes.find(t => t.id === state.theme);
  const styleObj = artStyles.find(s => s.id === state.style);

  const caption = [formatObj?.name, themeObj?.name, styleObj?.name]
    .filter(Boolean)
    .join(' + ');

  const themeGradient = themeObj?.gradient ?? PALETTE.parchment;
  const aspectCss =
    state.aspectRatio === '16:9' ? '16 / 9' : state.aspectRatio === '1:1' ? '1' : '9 / 16';
  const previewMaxWidth = state.aspectRatio === '16:9' ? 460 : 320;

  // Generate one real "first look" frame (skill Stage 3.5). Guarded against the
  // StrictMode double-invoke; cached in state so Back/Forward doesn't re-spend.
  const ranRef = useRef(false);
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    if (previewMode || state.combinationPreviewUrl) {
      setGenerating(false);
      return;
    }
    (async () => {
      const url = await generateCombinationPreview(
        state.characterSheetUrl,
        petName,
        state.theme,
        state.style,
        state.format,
        state.aspectRatio,
      );
      if (url) update({ combinationPreviewUrl: url });
      setGenerating(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <StageShell
      eyebrow="Direction — 3.5"
      title={`Here's ${petName}`}
      lede={caption ? `${caption} — a first look.` : 'A first look at the combination you chose.'}
      onBack={onBack}
      hideNext
    >
      <div style={{ maxWidth: previewMaxWidth, marginBottom: 32 }}>
        <div
          style={{
            aspectRatio: aspectCss,
            borderRadius: 4,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(42,33,27,0.13)',
            background: themeGradient,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {generating ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <Loader2 size={22} color="rgba(255,255,255,0.9)" style={{ animation: 'spin 1.2s linear infinite' }} />
              <Sans style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                a first look at {petName}…
              </Sans>
            </div>
          ) : state.combinationPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={state.combinationPreviewUrl}
              alt={`${petName} — ${caption}`}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ width: '100%' }}>
              <BeatScene
                beatIndex={0}
                themeGradient={themeGradient}
                aspect={state.aspectRatio === 'all_three' ? '9:16' : state.aspectRatio}
                species={state.petProfile?.species ?? 'dog'}
              />
            </div>
          )}
        </div>
        <div style={{ marginTop: 12, padding: '8px 12px', background: PALETTE.boneSoft, borderRadius: 3 }}>
          <Serif italic style={{ fontSize: 13, color: PALETTE.mute, lineHeight: 1.5 }}>
            {styleObj?.desc ?? 'Your chosen style.'}
          </Serif>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 400 }}>
        <Pill active onClick={onNext} large>
          Yes, this is it
        </Pill>
        <Pill
          onClick={() => {
            if (state.pickType === 'curated') {
              goToStep('style_confirm');
            } else {
              goToStep('format');
            }
          }}
          large
        >
          Try a different style, theme, or format
        </Pill>
        <Pill
          onClick={() => {
            if (state.pickType === 'curated') {
              goToStep('curators');
            } else {
              goToStep('format');
            }
          }}
          large
        >
          Start the picks over
        </Pill>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </StageShell>
  );
}
