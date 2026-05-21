"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Download } from 'lucide-react';
import { PALETTE } from '../lib/palette';
import { Serif, Sans, Eyebrow, PrimaryButton } from '../lib/primitives';
import { useBuilder } from '../state';
import { initialState } from '../state';
import type { StageProps } from './types';
import type { BuilderState } from '../state';
import { resolveText } from '@/lib/peternal-resolvers';
import { downloadEulogyPdf } from '@/lib/peternal-eulogy-pdf';
import { musicTracks, themes, narrationVoices } from '@/lib/peternal-library';
import TributePlayer from './TributePlayer';

// ---------------------------------------------------------------------------
// composeEulogy — builds a printable one-page eulogy from state
// ---------------------------------------------------------------------------
function composeEulogy(state: BuilderState): string {
  const name = state.petName || 'them';
  const gender = state.gender ?? 'neutral';
  const ctx = { gender, petName: name };
  const years = state.yearsIncluded && state.years ? ` (${state.years})` : '';
  const relationship = state.relationship ?? 'unspecified';
  const relLabel = relationship === 'unspecified' ? 'a beloved companion' : relationship.replace(/_/g, ' ');
  const memory = state.memoryPromptAnswer
    ? `\n\n${resolveText(`[PET_NAME] was ${relLabel} who ${state.memoryPromptAnswer}.`, { ...ctx })}`
    : '';
  const traits =
    state.traits.length > 0
      ? `\n\nAmong the things that made [PET_NAME] extraordinary: [PRONOUN_SUBJECT] was ${state.traits.join(', ')}.`
      : '';
  const favorites =
    state.favorites.length > 0
      ? `\n\n[PET_NAME] loved ${state.favorites.join(', ')}.`
      : '';
  const closingLine =
    state.cardText.closing || resolveText('Forever loved · [PET_NAME].', ctx);

  const body = resolveText(
    `In memory of [PET_NAME]${years}\n\n[PET_NAME] was ${relLabel}.${memory}${traits}${favorites}\n\n${closingLine}`,
    ctx,
  );
  return body;
}

// ---------------------------------------------------------------------------
// composeNarration — builds a flowing narration script from state.
// Always returns a non-empty string even when all optional questions are blank.
// ---------------------------------------------------------------------------
function composeNarration(state: BuilderState): string {
  const name = state.petName || 'them';
  const gender = state.gender ?? 'neutral';
  const ctx = { gender, petName: name };
  const relationship = state.relationship ?? 'unspecified';
  const relLabel = relationship === 'unspecified' ? 'a beloved companion' : relationship.replace(/_/g, ' ');
  const closingLine =
    state.cardText.closing || resolveText('Forever loved. [PET_NAME] will always be with us.', ctx);

  const parts: string[] = [];

  parts.push(resolveText(`This is a tribute to [PET_NAME] — [PRONOUN_SUBJECT] was ${relLabel}.`, ctx));

  if (state.traits.length > 0) {
    parts.push(resolveText(
      `[PRONOUN_SUBJECT_CAP] was ${state.traits.join(', ')}.`,
      ctx,
    ));
  }

  if (state.favorites.length > 0) {
    parts.push(resolveText(
      `[PET_NAME] loved ${state.favorites.join(', ')}.`,
      ctx,
    ));
  }

  if (state.memoryPromptAnswer) {
    parts.push(resolveText(`[PRONOUN_SUBJECT_CAP] was the kind of ${relLabel} who ${state.memoryPromptAnswer}.`, ctx));
  }

  // Narration letter answers (optional — any non-blank answers are included)
  for (const line of state.words.narrationLetter) {
    if (line && line.trim()) {
      parts.push(line.trim());
    }
  }

  parts.push(resolveText(closingLine, ctx));

  return parts.join(' ');
}

type DownloadStatus = 'idle' | 'preparing' | 'done' | 'error';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function FinishedTribute(_props: StageProps) {
  const { state, update } = useBuilder();
  const [showEulogy, setShowEulogy] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle');
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Single-fire ref guard — React StrictMode double-invokes effects.
  const musicStartedRef = useRef(false);

  useEffect(() => {
    // Generate a Suno music bed unless the user explicitly chose silence.
    // The bed plays in both the narration-off and narration-on cases — when
    // narration is on, Stage 7 (compose) ducks it to -18dB beneath the voice.
    if (state.words.music === 'silence') return;
    if (state.musicBedUrl) return;
    if (musicStartedRef.current) return;
    musicStartedRef.current = true;

    const themeObj = themes.find((t) => t.id === state.theme);
    const themeMood = themeObj ? themeObj.desc : 'gentle, peaceful, memorial';
    const selectedTrack = musicTracks.find((t) => t.id === state.words.music);
    const trackMood = selectedTrack ? `${selectedTrack.mood} — ${selectedTrack.description}` : 'warm and contemplative';
    const artStyleDesc = state.style ? state.style.replace(/_/g, ' ') : 'cinematic';

    const prompt =
      `Gentle, instrumental, emotional memorial music bed for a pet tribute video. ` +
      `Mood: ${themeMood}. Music character: ${trackMood}. Visual style: ${artStyleDesc}. ` +
      `No vocals. Soft, continuous, ambient — suitable as a background underscore for a 2-4 minute tribute.`;

    // Duration: total tribute length in seconds.
    const captionCardCount = Object.keys(state.captionCardImages).length;
    const cardsSeconds = 6 + captionCardCount * 2.5;
    const totalSeconds = Math.ceil(state.targetMinutes * 60 + cardsSeconds + captionCardCount * 2.5);

    (async () => {
      try {
        const res = await fetch('/api/video/music', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, durationSeconds: totalSeconds }),
        });
        if (res.ok) {
          const json = (await res.json()) as { url?: string; durationMs?: number };
          if (json.url) {
            update({ musicBedUrl: json.url, musicBedDurationMs: json.durationMs ?? null });
          }
        }
      } catch {
        // Music failure must never block the tribute — musicBedUrl stays null.
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const petName = state.petName || 'them';

  const eulogyText = composeEulogy(state);

  function handleRestart() {
    update({ ...initialState });
  }

  async function handleDownload() {
    if (Object.keys(state.beatVideos).length === 0) {
      setDownloadError('Still rendering — try again in a moment.');
      return;
    }

    // Guard: if narration is on but opening card hasn't been generated yet, surface a clear error.
    if (state.words.narration !== 'off' && !state.cardPreviewImages.opening) {
      setDownloadError('Card images are still being generated — please wait a moment and try again.');
      return;
    }

    setDownloadError(null);
    setDownloadStatus('preparing');

    // Never re-use a cached assembledVideoUrl — it may have been composed before
    // the card-upload fix and contain no text. Always re-compose on download.

    try {
      // Music bed: use the generated musicBedUrl (generated on mount by the useEffect above).
      const musicUrl = state.musicBedUrl ?? null;

      // Build narration script when narration is on.
      let narrationUrl: string | null = null;
      if (state.words.narration !== 'off') {
        const script = composeNarration(state);
        if (!script) {
          setDownloadError('Could not compose a narration script — please fill in at least a pet name.');
          setDownloadStatus('error');
          return;
        }
        // Resolve the Minimax voice_id from the chosen narration voice.
        const chosenVoice = narrationVoices.find((v) => v.id === state.words.narration);
        const minimaxVoiceId = chosenVoice?.minimaxVoiceId ?? 'Wise_Woman';
        try {
          const nRes = await fetch('/api/video/narration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: script, voice: minimaxVoiceId }),
          });
          if (nRes.ok) {
            const nJson = (await nRes.json()) as { url?: string };
            narrationUrl = nJson.url ?? null;
          } else {
            const nErr = (await nRes.json().catch(() => ({}) )) as { error?: string };
            setDownloadError(`Narration failed: ${nErr.error ?? nRes.statusText}`);
            setDownloadStatus('error');
            return;
          }
        } catch (nEx) {
          setDownloadError(`Narration request failed: ${nEx instanceof Error ? nEx.message : 'network error'}`);
          setDownloadStatus('error');
          return;
        }
      }

      const aspectRatioMap: Record<string, '9:16' | '16:9' | '1:1'> = {
        '9:16': '9:16',
        '16:9': '16:9',
        '1:1': '1:1',
        'all_three': '9:16',
      };
      const aspectRatio = aspectRatioMap[state.aspectRatio] ?? '9:16';

      // P1: attempt to burn caption overlays into beat footage via ffmpeg.
      // Fall back to P0 (full-frame captionCardUrl) if ffmpeg is unavailable or fails.
      const hasOverlays = Object.keys(state.captionOverlayImages).length > 0;
      const burnedVideoMap: Record<number, string> = {};
      let burnSucceeded = false;

      if (hasOverlays) {
        try {
          const burnBeats = state.beatSheet
            .filter((beat) => state.beatVideos[beat.index])
            .map((beat) => ({
              index: beat.index,
              videoUrl: state.beatVideos[beat.index],
              captionOverlayUrl: state.captionOverlayImages[beat.index] ?? undefined,
            }));

          const burnRes = await fetch('/api/video/burn-captions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ beats: burnBeats }),
          });

          if (burnRes.ok) {
            const burnJson = (await burnRes.json()) as { beats?: Array<{ index: number; burnedVideoUrl: string }> };
            if (Array.isArray(burnJson.beats)) {
              for (const b of burnJson.beats) {
                burnedVideoMap[b.index] = b.burnedVideoUrl;
              }
              burnSucceeded = true;
              update({ burnedBeatVideos: burnedVideoMap });
            }
          }
        } catch {
          // ffmpeg not installed or route error — fall through to P0
        }
      }

      // Duration math: distribute time evenly across beats, clamped 4–15s.
      // When P1 burn succeeded, caption cards are NOT in the compose timeline, so count = 0.
      const captionCardCount = burnSucceeded ? 0 : Object.keys(state.captionCardImages).length;
      const cardsSeconds = 6 + captionCardCount * 2.5;
      const beatLength = state.beatSheet.length || 1;
      const perBeatSeconds = Math.min(
        15,
        Math.max(4, Math.round((state.targetMinutes * 60 - cardsSeconds) / beatLength))
      );
      const perBeatMs = perBeatSeconds * 1000;

      // Build the beats array for compose.
      // P1 success: use burned video URLs, omit captionCardUrl (captions are in footage).
      // P0 fallback: use original videos + full-frame captionCardUrl.
      const composeBeatVideoMap = burnSucceeded ? burnedVideoMap : state.beatVideos;

      const res = await fetch('/api/video/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openingCardUrl: state.cardPreviewImages.opening,
          closingCardUrl: state.cardPreviewImages.closing,
          beats: state.beatSheet.map((beat) => ({
            index: beat.index,
            videoUrl: composeBeatVideoMap[beat.index] ?? state.beatVideos[beat.index],
            // When P1 burned captions into footage, don't send captionCardUrl.
            captionCardUrl: burnSucceeded ? undefined : state.captionCardImages[beat.index],
          })),
          aspectRatio,
          perBeatMs,
          // Skill: narration is the foreground voice; the music bed plays
          // beneath it, ducked to -18dB by the compose route's audio mix.
          narrationUrl: narrationUrl || null,
          musicUrl: musicUrl || null,
        }),
      });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? 'Assembly failed');
      }
      update({ assembledVideoUrl: json.url });

      // Fetch the composed MP4 as a blob so the browser downloads it
      // rather than opening it in a tab (cross-origin fal URLs trigger open-in-tab).
      const videoBlob = await fetch(json.url).then((r) => r.blob());
      const objectUrl = URL.createObjectURL(videoBlob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${petName}-tribute.mp4`;
      a.click();
      URL.revokeObjectURL(objectUrl);
      setDownloadStatus('done');
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Download failed');
      setDownloadStatus('error');
    }
  }

  return (
    <section style={{ paddingTop: 16 }}>
      <Eyebrow>Tribute · ready</Eyebrow>
      <Serif
        as="h2"
        italic
        style={{
          fontSize: 'clamp(40px, 5.5vw, 64px)',
          lineHeight: 1.05,
          marginTop: 14,
          marginBottom: 8,
          letterSpacing: '-0.01em',
        }}
      >
        For {petName}.
      </Serif>
      <Serif style={{ fontSize: 19, color: PALETTE.mute, lineHeight: 1.5, maxWidth: 600 }}>
        A {state.targetMinutes}-minute tribute, made with care. Yours to keep, yours to share.
      </Serif>

      {/* Tribute player */}
      <div style={{ marginTop: 32 }}>
        <TributePlayer />
      </div>

      {/* Closing credit */}
      {(state.yearsIncluded && state.years) || state.creatorName ? (
        <div style={{ marginTop: 14, textAlign: 'center' }}>
          {state.yearsIncluded && state.years && (
            <Serif italic style={{ fontSize: 16, color: PALETTE.mute, letterSpacing: '0.02em' }}>
              {petName} · {state.years}
            </Serif>
          )}
          {state.creatorName && (
            <Sans style={{ fontSize: 12, color: PALETTE.mute, marginTop: 4, letterSpacing: '0.08em' }}>
              Created by {state.creatorName}
            </Sans>
          )}
        </div>
      ) : null}

      {/* Action buttons */}
      <div style={{ marginTop: 32, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <PrimaryButton onClick={handleDownload} disabled={downloadStatus === 'preparing'}>
          <Download size={15} /> {downloadStatus === 'preparing' ? 'Preparing your tribute…' : 'Download tribute'}
        </PrimaryButton>
        {downloadError && (
          <div
            style={{
              padding: '12px 16px',
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: 4,
              maxWidth: 480,
            }}
          >
            <Sans style={{ fontSize: 14, color: '#B91C1C', lineHeight: 1.5 }}>
              {downloadError}
            </Sans>
          </div>
        )}
        <PrimaryButton onClick={() => {}} secondary>
          Get my memorial page link
        </PrimaryButton>
        <PrimaryButton onClick={() => {}} secondary>
          Add to family channel
        </PrimaryButton>
      </div>

      {/* Eulogy PDF offer */}
      <div
        style={{
          marginTop: 48,
          padding: '24px 26px',
          background: PALETTE.boneSoft,
          border: `1px solid ${PALETTE.parchmentLight}`,
          borderRadius: 4,
        }}
      >
        {!state.eulogyRequested ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ flex: 1 }}>
              <Eyebrow>Eulogy PDF</Eyebrow>
              <Serif italic style={{ fontSize: 19, color: PALETTE.espressoSoft, marginTop: 6 }}>
                Would you like a printable one-page eulogy for {petName}?
              </Serif>
              <Serif
                style={{
                  fontSize: 15,
                  color: PALETTE.mute,
                  lineHeight: 1.5,
                  marginTop: 8,
                  maxWidth: 520,
                }}
              >
                A composed page from everything you&apos;ve shared — designed to frame, keep, or pass on.
              </Serif>
            </div>
            <PrimaryButton
              onClick={() => {
                update({ eulogyRequested: true });
                setShowEulogy(true);
              }}
              small
            >
              Yes, compose it
            </PrimaryButton>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Eyebrow>Eulogy · composed</Eyebrow>
              <PrimaryButton onClick={() => downloadEulogyPdf(eulogyText, petName)} small secondary>
                <Download size={13} /> PDF
              </PrimaryButton>
            </div>
            {showEulogy && (
              <div
                style={{
                  background: 'white',
                  border: `1px solid ${PALETTE.parchmentLight}`,
                  borderRadius: 2,
                  padding: '28px 32px',
                  fontFamily: '"Cormorant Garamond", serif',
                  fontSize: 18,
                  fontStyle: 'italic',
                  color: PALETTE.espresso,
                  lineHeight: 1.75,
                  whiteSpace: 'pre-wrap',
                  maxWidth: 580,
                }}
              >
                {eulogyText}
              </div>
            )}
          </>
        )}
      </div>

      {/* Restart */}
      <div style={{ marginTop: 40, textAlign: 'center' }}>
        <button
          onClick={handleRestart}
          style={{
            background: 'transparent',
            border: 'none',
            color: PALETTE.mute,
            fontFamily: 'Inter, sans-serif',
            fontSize: 13,
            textDecoration: 'underline',
            textUnderlineOffset: 4,
            cursor: 'pointer',
          }}
        >
          Start a tribute for another pet
        </button>
      </div>
    </section>
  );
}
