"use client";

import React, { useState } from 'react';
import { Loader2, RotateCw, Play } from 'lucide-react';
import { PALETTE } from '../lib/palette';
import { Sans, Serif } from '../lib/primitives';
import { useBuilder } from '../state';
import { themes } from '@/lib/peternal-library';

// ---------------------------------------------------------------------------
// TributePlayer — plays the REAL composed tribute MP4.
//
// The finished video is shown at its NATURAL aspect ratio (the element wraps the
// video) so there are no black letterbox/pillarbox bars. The loading / idle /
// error states use a shaped aspect-ratio box so they still read as a player.
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

  const aspectId = state.aspectRatio === 'all_three' ? '9:16' : state.aspectRatio;
  const aspectRatioCss =
    aspectId === '9:16' ? '9 / 16' : aspectId === '16:9' ? '16 / 9' : '1';
  const maxHeight = aspectId === '9:16' ? 580 : 480;
  const frameWidth: string | number =
    aspectId === '9:16' ? 326 : aspectId === '1:1' ? 460 : '100%';
  const frameMaxWidth: number =
    aspectId === '16:9' ? 760 : aspectId === '1:1' ? 460 : 326;

  const themeObj = themes.find((t) => t.id === state.theme);
  const themeGradient = themeObj?.gradient ?? PALETTE.brass;

  // If the <video> source fails to load (e.g. an expired/forbidden URL), show a
  // recovery CTA instead of a black/broken frame. Tracked by URL so a re-mix
  // (fresh, durable S3 URL) automatically clears the failed state — no effect.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const videoFailed = !!assembledUrl && failedUrl === assembledUrl;

  // Shaped box used only for the non-video states (spinner / idle / error).
  const frameBox: React.CSSProperties = {
    aspectRatio: aspectRatioCss,
    background: themeGradient,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    maxHeight,
    width: frameWidth,
    maxWidth: frameMaxWidth,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 4,
    margin: '0 auto',
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      {!composing && assembledUrl && !videoFailed ? (
        // The real merged MP4 at its NATURAL size — the element wraps the video,
        // so no black bars. key forces a reload when a re-mix changes the URL.
        <video
          key={assembledUrl}
          src={assembledUrl}
          controls
          playsInline
          preload="metadata"
          onError={() => setFailedUrl(assembledUrl ?? null)}
          style={{
            display: 'block',
            width: '100%',
            maxWidth: frameMaxWidth,
            height: 'auto',
            borderRadius: 4,
            background: '#000',
          }}
        />
      ) : (
        <div style={frameBox}>
          {composing ? (
            <div style={centerCol}>
              <Loader2 size={26} color="white" style={{ animation: 'tp-spin 1.1s linear infinite' }} />
              <Sans style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.04em' }}>
                {phase || 'Assembling your tribute…'}
              </Sans>
            </div>
          ) : videoFailed ? (
            <div style={centerCol}>
              <Serif italic style={{ fontSize: 17, color: 'white', textAlign: 'center', maxWidth: 300, lineHeight: 1.4 }}>
                This video link expired. Re-mix to rebuild it.
              </Serif>
              {onRemix && (
                <button onClick={onRemix} style={ctaButtonStyle}>
                  <RotateCw size={14} /> Re-mix
                </button>
              )}
            </div>
          ) : error ? (
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
      )}

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
