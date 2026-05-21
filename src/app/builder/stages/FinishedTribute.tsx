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
import { musicTracks, themes } from '@/lib/peternal-library';
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
    // Only generate a music bed when narration is off and we don't already have one.
    if (state.words.narration !== 'off') return;
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
    setDownloadError(null);
    setDownloadStatus('preparing');

    // If we already composed once, just download the cached URL.
    if (state.assembledVideoUrl) {
      const a = document.createElement('a');
      a.href = state.assembledVideoUrl;
      a.download = `${petName}-tribute.mp4`;
      a.click();
      setDownloadStatus('done');
      return;
    }

    try {
      // Duration math: distribute time evenly across beats, clamped 4–15s.
      // cardsSeconds = 6 (opening + closing) + 2.5s per caption card that has an image
      const captionCardCount = Object.keys(state.captionCardImages).length;
      const cardsSeconds = 6 + captionCardCount * 2.5;
      const beatLength = state.beatSheet.length || 1;
      const perBeatSeconds = Math.min(
        15,
        Math.max(4, Math.round((state.targetMinutes * 60 - cardsSeconds) / beatLength))
      );
      const perBeatMs = perBeatSeconds * 1000;

      // Music bed: use the generated musicBedUrl (generated on mount by the useEffect above).
      const musicUrl = state.musicBedUrl ?? null;

      // Build narration script when narration is on.
      let narrationUrl: string | null = null;
      if (state.words.narration !== 'off') {
        try {
          const narrationLines = state.words.narrationLetter.filter(Boolean);
          if (narrationLines.length > 0) {
            const script = narrationLines.join(' ');
            const nRes = await fetch('/api/video/narration', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: script }),
            });
            if (nRes.ok) {
              const nJson = (await nRes.json()) as { url?: string };
              narrationUrl = nJson.url ?? null;
            }
          }
        } catch {
          // narration failure must never block download
        }
      }

      const aspectRatioMap: Record<string, '9:16' | '16:9' | '1:1'> = {
        '9:16': '9:16',
        '16:9': '16:9',
        '1:1': '1:1',
        'all_three': '9:16',
      };
      const aspectRatio = aspectRatioMap[state.aspectRatio] ?? '9:16';

      const res = await fetch('/api/video/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openingCardUrl: state.cardPreviewImages.opening,
          closingCardUrl: state.cardPreviewImages.closing,
          beats: state.beatSheet.map((beat) => ({
            index: beat.index,
            videoUrl: state.beatVideos[beat.index],
            captionCardUrl: state.captionCardImages[beat.index],
          })),
          aspectRatio,
          perBeatMs,
          // narration takes priority over music (XOR)
          narrationUrl: narrationUrl || null,
          musicUrl: narrationUrl ? null : (musicUrl || null),
          musicDurationMs: narrationUrl ? null : (state.musicBedDurationMs || null),
        }),
      });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? 'Assembly failed');
      }
      update({ assembledVideoUrl: json.url });
      const a = document.createElement('a');
      a.href = json.url;
      a.download = `${petName}-tribute.mp4`;
      a.click();
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
          <Sans style={{ fontSize: 13, color: PALETTE.mute, fontStyle: 'italic' }}>
            {downloadError}
          </Sans>
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
