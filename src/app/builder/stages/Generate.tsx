"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Maximize2, X, RefreshCw } from 'lucide-react';
import { PALETTE } from '../lib/palette';
import { Serif, Sans, Eyebrow, PrimaryButton } from '../lib/primitives';
import { BeatScene } from '../art';
import { useBuilder } from '../state';
import type { StageProps } from './types';
import { themes } from '@/lib/peternal-library';
import { generateBeatVideo, pollBeatVideo } from '../lib/generation';

const BATCH_SIZE = 3;
const POLL_INTERVAL_MS = 5000;

// Per-clip regeneration state.
interface ClipState {
  regenerating: boolean;
  showNoteInput: boolean;
  note: string;
}

function defaultClipState(): ClipState {
  return { regenerating: false, showNoteInput: false, note: '' };
}

export default function Generate({ onNext }: StageProps) {
  const { state, update } = useBuilder();
  const beatCount = state.beatCount;
  const [completedCount, setCompletedCount] = useState(
    () => Object.keys(state.beatVideos).length,
  );
  const [done, setDone] = useState(false);

  // Zoom modal state.
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);

  // Per-clip UI state (regenerating, note textarea open, note text).
  const [clipStates, setClipStates] = useState<Record<number, ClipState>>({});

  const themeObj = themes.find((t) => t.id === state.theme);
  const themeGradient = themeObj?.gradient ?? PALETTE.parchment;

  const aspectRatio =
    state.aspectRatio === '9:16'
      ? '9 / 16'
      : state.aspectRatio === '16:9'
      ? '16 / 9'
      : '1';

  // Per-beat video URL state — seeded from persisted beatVideos on return visit.
  const [beatVideoUrls, setBeatVideoUrls] = useState<Record<number, string>>(
    () => ({ ...state.beatVideos }),
  );

  // videoAccum is the shared mutable accumulator across async batch callbacks.
  // It must NOT be a state variable — state is stale inside async closures.
  const videoAccumRef = useRef<Record<number, string>>({ ...state.beatVideos });

  // Single-fire ref guard — React StrictMode double-invokes effects.
  const startedRef = useRef(false);

  useEffect(() => {
    // Return visit: already have all videos, skip regeneration.
    if (Object.keys(state.beatVideos).length >= beatCount) {
      setCompletedCount(beatCount);
      setDone(true);
      return;
    }

    if (startedRef.current) return;
    startedRef.current = true;

    const beats = state.beatSheet;
    const briefs = state.cinematographyBriefs;
    const characterSheetUrl = state.characterSheetUrl;

    // Duration math: distribute time evenly across beats, clamped 4–15s.
    // cardsSeconds = 6 (opening + closing) + 2.5s per caption card that has an image.
    // NOTE: the 6 = 2 cards × 3s must stay in sync with compose route's cardMs default (3000ms).
    const captionCardCount = Object.keys(state.captionCardImages).length;
    const cardsSeconds = 6 + captionCardCount * 2.5;
    const beatLength = beats.length || 1;
    const perBeatSeconds = Math.min(
      15,
      Math.max(4, Math.round((state.targetMinutes * 60 - cardsSeconds) / beatLength))
    );

    async function runGeneration() {
      if (briefs.length < beats.length) {
        console.error(
          `[Generate] cinematographyBriefs missing or short: expected ${beats.length}, got ${briefs.length}. ` +
          'Complete the Cinematography stage before generating.'
        );
      }

      const baseImageUrls: string[] = characterSheetUrl ? [characterSheetUrl] : [];

      let completed = Object.keys(state.beatVideos).length;

      // Mutable accumulator for all completed video URLs across batches.
      videoAccumRef.current = { ...state.beatVideos };

      for (let batchStart = 0; batchStart < beats.length; batchStart += BATCH_SIZE) {
        const batchIndices: number[] = [];
        for (
          let k = batchStart;
          k < Math.min(batchStart + BATCH_SIZE, beats.length);
          k++
        ) {
          if (!state.beatVideos[k]) batchIndices.push(k);
        }
        if (batchIndices.length === 0) continue;

        const submissions = await Promise.all(
          batchIndices.map(async (i) => {
            const beat = beats[i];
            const brief = briefs[i];
            if (!beat || !brief) return { i, job: null };

            const storyboardFrame = state.storyboardImages[i];
            const imageUrls = [
              ...(storyboardFrame ? [storyboardFrame] : []),
              ...baseImageUrls,
            ];

            const job = await generateBeatVideo({
              beat,
              brief,
              imageUrls,
              petName: state.petName || 'your pet',
              species: state.petProfile?.species || 'pet',
              traits: state.traits,
              favorites: state.favorites,
              format: state.format,
              theme: state.theme,
              style: state.style,
              aspectRatio: state.aspectRatio,
              duration: String(perBeatSeconds),
            });
            return { i, job };
          }),
        );

        const pending = submissions.filter((s) => s.job !== null) as {
          i: number;
          job: { requestId: string; endpoint: string };
        }[];

        await Promise.all(
          pending.map(async ({ i, job }) => {
            const MAX_CONSECUTIVE_ERRORS = 5;
            // Raised from 6 min to 10 min — longer clips (up to 15s) render slower.
            const DEADLINE_MS = 10 * 60 * 1000;
            const deadline = Date.now() + DEADLINE_MS;
            let consecutiveErrors = 0;
            for (;;) {
              await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
              if (Date.now() > deadline) break;
              const result = await pollBeatVideo(job.endpoint, job.requestId, i);
              if (!result) {
                consecutiveErrors += 1;
                if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) break;
                continue;
              }
              consecutiveErrors = 0;
              if (result.status === 'COMPLETED') {
                if (result.url) {
                  setBeatVideoUrls((prev) => ({ ...prev, [i]: result.url! }));
                  videoAccumRef.current[i] = result.url!;
                  update({ beatVideos: { ...videoAccumRef.current } });
                }
                completed += 1;
                setCompletedCount(completed);
                break;
              }
            }
          }),
        );

        const failedCount = batchIndices.length - pending.length;
        if (failedCount > 0) {
          completed += failedCount;
          setCompletedCount(completed);
        }
      }

      setDone(true);
    }

    runGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progress = Math.min(completedCount, beatCount);

  // Per-clip state helpers.
  function getClipState(i: number): ClipState {
    return clipStates[i] ?? defaultClipState();
  }
  function setClipField<K extends keyof ClipState>(i: number, key: K, val: ClipState[K]) {
    setClipStates((prev) => ({
      ...prev,
      [i]: { ...(prev[i] ?? defaultClipState()), [key]: val },
    }));
  }

  // Regenerate a single beat with a user note.
  const regenerateClip = useCallback(
    async (i: number) => {
      const beat = state.beatSheet[i];
      const brief = state.cinematographyBriefs[i];
      if (!beat || !brief) return;

      const note = getClipState(i).note;
      setClipField(i, 'regenerating', true);
      setClipField(i, 'showNoteInput', false);

      const baseImageUrls: string[] = state.characterSheetUrl ? [state.characterSheetUrl] : [];
      const storyboardFrame = state.storyboardImages[i];
      const imageUrls = [
        ...(storyboardFrame ? [storyboardFrame] : []),
        ...baseImageUrls,
      ];

      // Same duration formula as the batch run.
      // NOTE: the 6 = 2 cards × 3s must stay in sync with compose route's cardMs default (3000ms).
      const captionCardCount = Object.keys(state.captionCardImages).length;
      const cardsSeconds = 6 + captionCardCount * 2.5;
      const regenBeatLength = state.beatSheet.length || 1;
      const perBeatSeconds = Math.min(
        15,
        Math.max(4, Math.round((state.targetMinutes * 60 - cardsSeconds) / regenBeatLength))
      );

      const job = await generateBeatVideo({
        beat,
        brief,
        imageUrls,
        petName: state.petName || 'your pet',
        species: state.petProfile?.species || 'pet',
        traits: state.traits,
        favorites: state.favorites,
        format: state.format,
        theme: state.theme,
        style: state.style,
        aspectRatio: state.aspectRatio,
        duration: String(perBeatSeconds),
        userNote: note || undefined,
      });

      if (!job) {
        setClipField(i, 'regenerating', false);
        return;
      }

      // Poll until done.
      const MAX_CONSECUTIVE_ERRORS = 5;
      // Raised from 6 min to 10 min — longer clips (up to 15s) render slower.
      const DEADLINE_MS = 10 * 60 * 1000;
      const deadline = Date.now() + DEADLINE_MS;
      let consecutiveErrors = 0;
      for (;;) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        if (Date.now() > deadline) break;
        const result = await pollBeatVideo(job.endpoint, job.requestId, i);
        if (!result) {
          consecutiveErrors += 1;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) break;
          continue;
        }
        consecutiveErrors = 0;
        if (result.status === 'COMPLETED') {
          if (result.url) {
            setBeatVideoUrls((prev) => ({ ...prev, [i]: result.url! }));
            // Spread the LATEST accumulator to avoid clobbering concurrent completions.
            videoAccumRef.current[i] = result.url!;
            update({ beatVideos: { ...videoAccumRef.current } });
          }
          break;
        }
      }

      setClipStates((prev) => ({
        ...prev,
        [i]: { ...(prev[i] ?? defaultClipState()), regenerating: false, note: '' },
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.beatSheet, state.cinematographyBriefs, state.characterSheetUrl, state.storyboardImages, state.captionCardImages, state.petName, state.petProfile, state.traits, state.favorites, state.format, state.theme, state.style, state.aspectRatio, state.targetMinutes, state.beatCount, clipStates],
  );

  // Close zoom modal on Escape.
  useEffect(() => {
    if (zoomedIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomedIndex(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoomedIndex]);

  return (
    <section style={{ paddingTop: 32 }}>
      <Eyebrow>Stage 6 · Rendering</Eyebrow>
      <Serif
        as="h2"
        italic
        style={{
          fontSize: 'clamp(36px, 5vw, 56px)',
          lineHeight: 1.05,
          marginTop: 14,
          marginBottom: 8,
          letterSpacing: '-0.01em',
        }}
      >
        {done ? <>Review your scenes.</> : <>We&apos;re making it now.</>}
      </Serif>
      <Serif
        style={{
          fontSize: 19,
          color: PALETTE.mute,
          lineHeight: 1.5,
          maxWidth: 580,
        }}
      >
        {done
          ? 'Watch each clip. Regenerate any you\'d like changed, then continue to your tribute.'
          : 'Each scene is being rendered, reviewed, and gently scored.'}
      </Serif>

      {!done && (
        <div style={{ marginTop: 40 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 12,
            }}
          >
            <Sans
              style={{
                fontSize: 12,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: PALETTE.brassDeep,
              }}
            >
              Beat {progress} of {beatCount}
            </Sans>
            <Sans style={{ fontSize: 12, color: PALETTE.mute }}>
              {Math.round((progress / beatCount) * 100)}%
            </Sans>
          </div>
          <div
            style={{
              height: 2,
              background: PALETTE.parchmentLight,
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${(progress / beatCount) * 100}%`,
                background: PALETTE.brass,
                transition: 'width 380ms ease',
              }}
            />
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 10,
          marginTop: 32,
        }}
      >
        {Array.from({ length: beatCount }).map((_, i) => {
          const videoUrl = beatVideoUrls[i];
          const isCompleted = i < progress;
          const isCurrent = !done && !videoUrl && i === progress;
          const cs = getClipState(i);

          if (videoUrl || isCompleted) {
            const frame = state.storyboardImages[i];
            const beatName = state.beatSheet[i]?.name ?? `Clip ${i + 1}`;
            return (
              <div
                key={i}
                style={{
                  borderRadius: 4,
                  overflow: 'hidden',
                  border: `1px solid ${PALETTE.parchmentLight}`,
                  transition: 'all 400ms ease',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Media area — clickable to zoom */}
                <div
                  style={{ position: 'relative', cursor: 'pointer' }}
                  onClick={() => !cs.regenerating && setZoomedIndex(i)}
                >
                  {cs.regenerating ? (
                    <div
                      style={{
                        aspectRatio,
                        background: PALETTE.boneSoft,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Loader2
                        size={18}
                        color={PALETTE.brass}
                        style={{ animation: 'spin 1.2s linear infinite' }}
                      />
                    </div>
                  ) : videoUrl ? (
                    <video
                      src={videoUrl}
                      loop
                      muted
                      playsInline
                      style={{ display: 'block', width: '100%', aspectRatio, objectFit: 'cover' }}
                    />
                  ) : frame ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={frame}
                      alt={beatName}
                      style={{ display: 'block', width: '100%', aspectRatio, objectFit: 'cover' }}
                    />
                  ) : (
                    <BeatScene
                      beatIndex={i}
                      themeGradient={themeGradient}
                      aspect={state.aspectRatio === 'all_three' ? '1:1' : state.aspectRatio}
                      species="dog"
                    />
                  )}
                  {/* Zoom icon overlay (not shown while regenerating) */}
                  {!cs.regenerating && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        background: 'rgba(42,33,27,0.55)',
                        borderRadius: 3,
                        padding: '3px 4px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Maximize2 size={11} color={PALETTE.bone} />
                    </div>
                  )}
                </div>

                {/* Regenerate controls */}
                {!cs.regenerating && (
                  <div
                    style={{
                      padding: '6px 8px',
                      borderTop: `1px solid ${PALETTE.parchmentLight}`,
                      background: PALETTE.boneSoft,
                    }}
                  >
                    {cs.showNoteInput ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <textarea
                          value={cs.note}
                          onChange={(e) => setClipField(i, 'note', e.target.value)}
                          placeholder="What should change?"
                          rows={2}
                          style={{
                            width: '100%',
                            fontFamily: 'Inter, sans-serif',
                            fontSize: 11,
                            padding: '6px 8px',
                            border: `1px solid ${PALETTE.parchmentLight}`,
                            borderRadius: 3,
                            background: 'white',
                            color: PALETTE.espresso,
                            resize: 'vertical',
                            boxSizing: 'border-box',
                            outline: 'none',
                          }}
                        />
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => regenerateClip(i)}
                            style={{
                              flex: 1,
                              fontFamily: 'Inter, sans-serif',
                              fontSize: 11,
                              padding: '5px 8px',
                              background: PALETTE.espresso,
                              color: PALETTE.bone,
                              border: 'none',
                              borderRadius: 3,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 4,
                            }}
                          >
                            <RefreshCw size={10} /> Regenerate
                          </button>
                          <button
                            onClick={() => setClipField(i, 'showNoteInput', false)}
                            style={{
                              fontFamily: 'Inter, sans-serif',
                              fontSize: 11,
                              padding: '5px 8px',
                              background: 'transparent',
                              color: PALETTE.mute,
                              border: `1px solid ${PALETTE.parchmentLight}`,
                              borderRadius: 3,
                              cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setClipField(i, 'showNoteInput', true)}
                        style={{
                          width: '100%',
                          fontFamily: 'Inter, sans-serif',
                          fontSize: 11,
                          padding: '4px 6px',
                          background: 'transparent',
                          color: PALETTE.mute,
                          border: `1px solid ${PALETTE.parchmentLight}`,
                          borderRadius: 3,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                        }}
                      >
                        <RefreshCw size={10} /> Regenerate
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div
              key={i}
              style={{
                aspectRatio,
                background: PALETTE.boneSoft,
                border: `1px solid ${isCurrent ? PALETTE.brass : PALETTE.parchmentLight}`,
                borderRadius: 4,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 400ms ease',
              }}
            >
              {isCurrent ? (
                <Loader2
                  size={18}
                  color={PALETTE.brass}
                  style={{ animation: 'spin 1.2s linear infinite' }}
                />
              ) : (
                <Sans style={{ fontSize: 11, color: PALETTE.mute }}>{i + 1}</Sans>
              )}
            </div>
          );
        })}
      </div>

      {/* Continue button — only shown when all beats are done */}
      {done && (
        <div
          style={{
            marginTop: 36,
            paddingTop: 24,
            borderTop: `1px solid ${PALETTE.parchmentLight}`,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <PrimaryButton
            onClick={() => {
              update({ generationComplete: true });
              onNext();
            }}
          >
            Continue to your tribute
          </PrimaryButton>
        </div>
      )}

      {/* Fullscreen zoom modal */}
      {zoomedIndex !== null && (() => {
        const i = zoomedIndex;
        const videoUrl = beatVideoUrls[i];
        const frame = state.storyboardImages[i];
        const beatName = state.beatSheet[i]?.name ?? `Clip ${i + 1}`;
        return (
          <div
            onClick={() => setZoomedIndex(null)}
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
            {/* Close button */}
            <button
              onClick={() => setZoomedIndex(null)}
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
            {/* Media — stop click propagation so clicking the video doesn't close the modal */}
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '90vw', maxHeight: '90vh' }}
            >
              {videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  playsInline
                  style={{
                    display: 'block',
                    maxWidth: '90vw',
                    maxHeight: '85vh',
                    borderRadius: 6,
                  }}
                />
              ) : frame ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={frame}
                  alt={beatName}
                  style={{
                    display: 'block',
                    maxWidth: '90vw',
                    maxHeight: '85vh',
                    borderRadius: 6,
                    objectFit: 'contain',
                  }}
                />
              ) : (
                <div style={{ color: 'white', fontFamily: 'Inter, sans-serif' }}>
                  No preview available for this clip.
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
