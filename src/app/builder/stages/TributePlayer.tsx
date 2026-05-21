"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { PALETTE } from '../lib/palette';
import { Sans, Serif } from '../lib/primitives';
import { useBuilder } from '../state';
import CardArt from '../art/CardArt';
import BeatScene from '../art/BeatScene';
import { themes } from '@/lib/peternal-library';
import { resolveText } from '@/lib/peternal-resolvers';

// Segment types
type Segment =
  | { kind: 'card'; cardType: 'opening' | 'closing'; text: string; imageUrl?: string; duration: 3000 }
  | { kind: 'captionCard'; beatIndex: number; url: string; duration: 2500 }
  | { kind: 'video'; beatIndex: number; url: string }
  | { kind: 'image'; beatIndex: number; url: string; duration: 4000 }
  | { kind: 'scene'; beatIndex: number; duration: 4000 };

function buildSegments(
  beatSheet: import('../state').Beat[],
  beatVideos: Record<number, string>,
  storyboardImages: Record<number, string>,
  captionCardImages: Record<number, string>,
  cardPreviewImages: { opening: string | null; closing: string | null; caption: string | null },
  openingText: string,
  closingText: string,
): Segment[] {
  const segs: Segment[] = [];
  segs.push({
    kind: 'card',
    cardType: 'opening',
    text: openingText,
    imageUrl: cardPreviewImages.opening ?? undefined,
    duration: 3000,
  });
  for (let i = 0; i < beatSheet.length; i++) {
    // If a caption card image exists for this beat, show it before the beat video (matches compose timeline).
    if (captionCardImages[i]) {
      segs.push({ kind: 'captionCard', beatIndex: i, url: captionCardImages[i], duration: 2500 });
    }
    if (beatVideos[i]) {
      segs.push({ kind: 'video', beatIndex: i, url: beatVideos[i] });
    } else if (storyboardImages[i]) {
      segs.push({ kind: 'image', beatIndex: i, url: storyboardImages[i], duration: 4000 });
    } else {
      segs.push({ kind: 'scene', beatIndex: i, duration: 4000 });
    }
  }
  segs.push({
    kind: 'card',
    cardType: 'closing',
    text: closingText,
    imageUrl: cardPreviewImages.closing ?? undefined,
    duration: 3000,
  });
  return segs;
}

export default function TributePlayer() {
  const { state } = useBuilder();

  // Continuous audio bed in the preview: music bed when narration is off.
  // Narration is generated only at export time and is not previewed here.
  const activeBedUrl = state.words.narration === 'off' ? (state.musicBedUrl ?? null) : null;

  const petName = state.petName || 'them';
  const gender = state.gender ?? 'neutral';
  const ctx = { gender, petName };

  const openingText =
    state.cardText.opening ||
    resolveText('[PET_NAME] · a tribute', ctx);
  const closingText =
    state.cardText.closing ||
    resolveText('Forever loved · [PET_NAME].', ctx);

  const containerId =
    state.typographyLocked ?? state.captionContainer ?? 'cinematic_lower_third';
  const artStyle = state.style ?? undefined;

  const themeObj = themes.find((t) => t.id === state.theme);
  const themeGradient = themeObj?.gradient ?? PALETTE.brass;

  const aspectId = state.aspectRatio === 'all_three' ? '9:16' : state.aspectRatio;
  const aspectRatioCss =
    aspectId === '9:16' ? '9 / 16' : aspectId === '16:9' ? '16 / 9' : '1';

  const maxHeight = aspectId === '9:16' ? 580 : 480;
  // The frame needs an EXPLICIT width — with only maxWidth/maxHeight and
  // absolutely-positioned content, an aspect-ratio box collapses to zero size.
  const frameWidth: string | number =
    aspectId === '9:16' ? 326 : aspectId === '1:1' ? 460 : '100%';
  const frameMaxWidth: number =
    aspectId === '16:9' ? 760 : aspectId === '1:1' ? 460 : 326;

  const segments = buildSegments(
    state.beatSheet,
    state.beatVideos,
    state.storyboardImages,
    state.captionCardImages,
    state.cardPreviewImages,
    openingText,
    closingText,
  );
  const total = segments.length;

  const [segIdx, setSegIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const advance = useCallback(() => {
    setSegIdx((prev) => {
      if (prev >= total - 1) {
        setPlaying(false);
        return prev;
      }
      return prev + 1;
    });
  }, [total]);

  // When segment changes, handle timed segments
  useEffect(() => {
    clearTimer();
    const seg = segments[segIdx];
    if (!seg) return;
    if (playing && seg.kind !== 'video') {
      timerRef.current = setTimeout(advance, (seg as { duration: number }).duration);
    }
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segIdx, playing]);

  // Manage video element when segment is a video
  useEffect(() => {
    const seg = segments[segIdx];
    if (!seg || seg.kind !== 'video') return;
    const vid = videoRef.current;
    if (!vid) return;
    vid.src = seg.url;
    vid.load();
    if (playing) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segIdx]);

  // Play/pause video when `playing` changes
  useEffect(() => {
    const seg = segments[segIdx];
    const vid = videoRef.current;
    if (!seg || seg.kind !== 'video' || !vid) return;
    if (playing) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Restart timed segments when playing resumes
  useEffect(() => {
    clearTimer();
    const seg = segments[segIdx];
    if (!seg || !playing || seg.kind === 'video') return;
    timerRef.current = setTimeout(advance, (seg as { duration: number }).duration);
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Sync the music bed audio with the player transport.
  // The audio element is independent of segIdx — it runs continuously across all segments.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [playing]);

  function handleRestart() {
    clearTimer();
    setSegIdx(0);
    setPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }

  function handlePlayPause() {
    setPlaying((p) => !p);
  }

  function handleVideoEnded() {
    advance();
  }

  // Derive caption for current beat (not shown on captionCard segments — they are the card)
  const seg = segments[segIdx];
  const beatIndexForCaption =
    seg && (seg.kind === 'video' || seg.kind === 'image' || seg.kind === 'scene')
      ? seg.beatIndex
      : null;
  const caption =
    beatIndexForCaption !== null
      ? state.words.captions.find((c) => c.beatIndex === beatIndexForCaption)?.text ?? null
      : null;

  // Beat N of total indicator (exclude card and captionCard segments from beat count)
  const beatSegs = segments.filter((s) => s.kind !== 'card' && s.kind !== 'captionCard');
  const currentBeatNumber =
    seg && seg.kind !== 'card' && seg.kind !== 'captionCard'
      ? beatSegs.indexOf(seg) + 1
      : null;

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
      {/* Hidden continuous audio bed — plays across all segments, independent of segIdx */}
      {activeBedUrl && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio
          ref={audioRef}
          src={activeBedUrl}
          loop
          style={{ display: 'none' }}
        />
      )}
      {/* Frame */}
      <div
        style={{
          aspectRatio: aspectRatioCss,
          background: themeGradient,
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
        {/* Card segments — show real generated image when available, else SVG fallback */}
        {seg && seg.kind === 'card' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: themeGradient,
            }}
          >
            {seg.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={seg.imageUrl}
                alt={seg.cardType}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <CardArt
                containerId={containerId}
                text={seg.text}
                aspectRatio={aspectId}
                artStyle={artStyle ?? undefined}
                cardType={seg.cardType}
              />
            )}
          </div>
        )}

        {/* Caption card image segment — shown before the beat video it belongs to */}
        {seg && seg.kind === 'captionCard' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={seg.url}
            alt={`Caption card for beat ${seg.beatIndex + 1}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}

        {/* Video segment — muted because the music bed is the sole audio source */}
        {seg && seg.kind === 'video' && (
          <video
            ref={videoRef}
            onEnded={handleVideoEnded}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            playsInline
            preload="auto"
            muted
          />
        )}

        {/* Image (storyboard still) segment */}
        {seg && seg.kind === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={seg.url}
            alt={`Beat ${seg.beatIndex + 1}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}

        {/* BeatScene fallback */}
        {seg && seg.kind === 'scene' && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <BeatScene
              beatIndex={seg.beatIndex}
              themeGradient={themeGradient}
              aspect={aspectId}
              species={state.petProfile?.species}
            />
          </div>
        )}

        {/* Caption lower-third (video/image/scene only — not on card or captionCard segments) */}
        {caption && seg && seg.kind !== 'card' && seg.kind !== 'captionCard' && (() => {
          const overlayUrl = beatIndexForCaption !== null
            ? state.captionOverlayImages[beatIndexForCaption] ?? null
            : null;
          if (overlayUrl) {
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={overlayUrl}
                alt="caption overlay"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'fill',
                  pointerEvents: 'none',
                }}
              />
            );
          }
          return (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'linear-gradient(transparent, rgba(0,0,0,0.55))',
                padding: '32px 20px 18px',
                pointerEvents: 'none',
              }}
            >
              <Serif
                italic
                style={{
                  fontSize: 15,
                  color: 'white',
                  textShadow: '0 1px 8px rgba(0,0,0,0.5)',
                  lineHeight: 1.4,
                  textAlign: 'center',
                }}
              >
                {caption}
              </Serif>
            </div>
          );
        })()}

        {/* Controls overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: 14,
            right: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {/* Restart */}
          <button
            onClick={handleRestart}
            aria-label="Restart"
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.45)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={15} color="white" />
          </button>

          {/* Play / Pause */}
          <button
            onClick={handlePlayPause}
            aria-label={playing ? 'Pause' : 'Play'}
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.95)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}
          >
            {playing ? (
              <Pause size={20} color={PALETTE.espresso} />
            ) : (
              <Play size={20} color={PALETTE.espresso} style={{ marginLeft: 3 }} />
            )}
          </button>
        </div>

        {/* Beat counter */}
        {currentBeatNumber !== null && (
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 14,
              pointerEvents: 'none',
            }}
          >
            <Sans
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.82)',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}
            >
              Beat {currentBeatNumber} of {beatSegs.length}
            </Sans>
          </div>
        )}
      </div>
    </div>
  );
}
