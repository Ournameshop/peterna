"use client";

import React from 'react';
import { Loader2, RotateCw, Play } from 'lucide-react';
import { PALETTE } from '../lib/palette';
import { Sans, Serif } from '../lib/primitives';
import { useBuilder } from '../state';
import { themes } from '@/lib/peternal-library';

// ---------------------------------------------------------------------------
// TributePlayer — plays the REAL composed tribute MP4.
//
// Previously this component re-stitched the raw beat clips + cards client-side
// (a "simulation"). That produced blank frames between segments and, more
// importantly, never matched the downloaded output (no music/narration mux, no
// burned captions, no real card timing). We now play the single merged file
// produced by /api/video/compose — the same artifact the user downloads — which
// mirrors builder.blck's StepFinal (it plays Show.masterVideoUrl directly).
// ---------------------------------------------------------------------------

interface TributePlayerProps {
  /** The single composed/merged MP4 — the real output. Played directly when present. */
  assembledUrl?: string | null;
  /** True while the server is assembling the video. */
  composing?: boolean;
  /** Short status line shown beneath the spinner while composing. */
  phase?: string | null;
  /** Compose error, if any. */
  error?: string | null;
  /** Re-mix / retry handler — re-runs the compose on the existing clips. */
  onRemix?: () => void;
}

export default function TributePlayer({
  assembledUrl,
  composing = false,
  phase,
  error,
  onRemix,
}: TributePlayerProps) {
  const { state } = useBuilder();

  // Aspect-ratio framing — keep the frame matching the chosen format so the
  // player reads as a finished piece, not a raw video tag.
  const aspectId = state.aspectRatio === 'all_three' ? '9:16' : state.aspectRatio;
  const aspectRatioCss =
    aspectId === '9:16' ? '9 / 16' : aspectId === '16:9' ? '16 / 9' : '1';
  const maxHeight = aspectId === '9:16' ? 580 : 480;
  // The frame needs an EXPLICIT width — an aspect-ratio box with only
  // maxWidth/maxHeight collapses to zero.
  const frameWidth: string | number =
    aspectId === '9:16' ? 326 : aspectId === '1:1' ? 460 : '100%';
  const frameMaxWidth: number =
    aspectId === '16:9' ? 760 : aspectId === '1:1' ? 460 : 326;

  const themeObj = themes.find((t) => t.id === state.theme);
  const themeGradient = themeObj?.gradient ?? PALETTE.brass;

  return (
    <div
      style={{
        background: PALETTE.espresso,
        borderRadius: 4,
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          aspectRatio: aspectRatioCss,
          background: assembledUrl ? '#000' : themeGradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          maxHeight,
          margin: '0 auto',
          width: frameWidth,
          maxWidth: frameMaxWidth,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 1) Assembling — checked FIRST so a re-mix shows progress instead of
              the stale previous cut (whose URL is still set while it runs). */}
        {composing ? (
          <div style={centerCol}>
            <Loader2 size={26} color="white" style={{ animation: 'tp-spin 1.1s linear infinite' }} />
            <Sans style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.04em' }}>
              {phase || 'Assembling your tribute…'}
            </Sans>
          </div>
        ) : assembledUrl ? (
          /* 2) The real merged MP4 — native controls, single source, no blanks.
                key={assembledUrl} forces a fresh <video> when a re-mix produces a
                new URL so the element reloads the new file. */
          <video
            key={assembledUrl}
            src={assembledUrl}
            controls
            playsInline
            preload="metadata"
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000' }}
          />
        ) : error ? (
          /* 3) Compose failed */
          <div style={centerCol}>
            <Serif italic style={{ fontSize: 17, color: 'white', textAlign: 'center', maxWidth: 280, lineHeight: 1.4 }}>
              {error}
            </Serif>
            {onRemix && (
              <button onClick={onRemix} style={ctaButtonStyle}>
                <RotateCw size={14} /> Try again
              </button>
            )}
          </div>
        ) : (
          /* 4) Idle — not composed yet (e.g. still waiting on music). Never a
                stuck spinner: the user can assemble on demand. */
          <div style={centerCol}>
            <Serif italic style={{ fontSize: 17, color: 'rgba(255,255,255,0.92)', textAlign: 'center', maxWidth: 300, lineHeight: 1.4 }}>
              Your tribute will appear here once it&apos;s assembled.
            </Serif>
            {onRemix && (
              <button onClick={onRemix} style={ctaButtonStyle}>
                <Play size={14} /> Assemble the video
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes tp-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const centerCol: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 14,
  padding: 24,
};

const ctaButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontFamily: 'Inter, sans-serif',
  fontSize: 13,
  letterSpacing: '0.04em',
  padding: '9px 18px',
  background: 'rgba(255,255,255,0.95)',
  color: PALETTE.espresso,
  border: 'none',
  borderRadius: 3,
  cursor: 'pointer',
};
