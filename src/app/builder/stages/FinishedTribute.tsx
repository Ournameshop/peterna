"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Download, ChevronLeft, RotateCw, Pencil } from 'lucide-react';
import { PALETTE } from '../lib/palette';
import { Serif, Sans, Eyebrow, PrimaryButton } from '../lib/primitives';
import { useBuilder, usePreviewMode } from '../state';
import { initialState } from '../state';
import type { StageProps } from './types';
import type { BuilderState } from '../state';
import { resolveText } from '@/lib/peternal-resolvers';
import { downloadEulogyPdf } from '@/lib/peternal-eulogy-pdf';
import { musicTracks, narrationVoices } from '@/lib/peternal-library';
import { buildInstrumentalPrompt } from '@/lib/music-prompts';
import { composeNarrationScript } from '../lib/generation';
import { computeTributeAudioSeconds } from '../lib/tribute-duration';
import TributePlayer from './TributePlayer';
import type { NarrationWord } from '@/lib/peternal-subtitles';

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

// A preset music bed is generated asynchronously on the finished step (the
// mount effect below). That is the ONLY music we should wait for before
// assembling — upload / lyric / custom / ambient modes either already have
// their bed or aren't generating one here. Composing while a preset bed is
// still pending would silently produce a video with no music.
function presetBedPending(state: BuilderState): boolean {
  return (
    state.words.music !== 'silence' &&
    state.musicIntent !== 'lyric' &&
    state.words.musicMode === 'preset' &&
    state.words.musicApproved &&
    !state.musicBedUrl
  );
}

type DownloadStatus = 'idle' | 'preparing' | 'done' | 'error';
type ShareStatus = 'idle' | 'preparing' | 'done' | 'error';

export default function FinishedTribute({ onBack, goToStep }: StageProps) {
  const { state, update } = useBuilder();
  const previewMode = usePreviewMode();
  const [showEulogy, setShowEulogy] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle');
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadPhase, setDownloadPhase] = useState('');
  const downloadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [shareStatus, setShareStatus] = useState<ShareStatus>('idle');
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  // Compose state — the finished step assembles the REAL MP4 (the same file the
  // user downloads) and the player plays THAT, not a client-side simulation.
  const [composeStatus, setComposeStatus] = useState<'idle' | 'composing' | 'error'>('idle');
  const [composePhase, setComposePhase] = useState('');
  const [composeError, setComposeError] = useState<string | null>(null);
  const composeStartedRef = useRef(false);

  // Single-fire ref guard — React StrictMode double-invokes effects.
  const musicStartedRef = useRef(false);

  useEffect(() => {
    // Generate a Suno music bed unless the user explicitly chose silence.
    // The bed plays in both the narration-off and narration-on cases — when
    // narration is on, Stage 7 (compose) ducks it to -18dB beneath the voice.
    if (previewMode) return;
    if (state.words.music === 'silence') return;
    if (state.musicBedUrl) return;
    if (state.musicIntent === 'lyric') return;
    if (state.words.musicMode !== 'preset') return;
    if (!state.words.musicApproved) return;
    if (musicStartedRef.current) return;
    musicStartedRef.current = true;

    const selectedTrack = musicTracks.find((t) => t.id === state.words.music);
    const prompt = buildInstrumentalPrompt(state, selectedTrack?.name, selectedTrack?.mood);
    const style = state.words.musicStyle || (selectedTrack?.description ?? 'gentle memorial, soft piano, warm strings');
    const title = state.words.musicTitle || `For ${state.petName || 'You'}`.slice(0, 80);

    // Duration: total tribute length in seconds.
    const totalSeconds = computeTributeAudioSeconds(state);

    (async () => {
      try {
        const res = await fetch('/api/video/music', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'instrumental', prompt, style, title, durationSeconds: totalSeconds }),
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

  // Generate the narration voiceover on mount when narration is on, so it can
  // be HEARD in the preview (and reused at compose time, not regenerated).
  const narrationStartedRef = useRef(false);
  useEffect(() => {
    if (previewMode) return;
    if (state.words.narration === 'off') return;
    if (state.narrationUrl) return;
    if (narrationStartedRef.current) return;
    narrationStartedRef.current = true;

    const chosenVoice = narrationVoices.find((v) => v.id === state.words.narration);
    const elevenVoice = chosenVoice?.elevenVoice ?? 'Rachel';

    (async () => {
      const script = await composeNarrationScript(state);
      if (!script) return;
      try {
        const res = await fetch('/api/video/narration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: script, voice: elevenVoice }),
        });
        if (res.ok) {
          const json = (await res.json()) as { url?: string; durationMs?: number; timestamps?: NarrationWord[] | null };
          if (json.url) update({
            narrationUrl: json.url,
            narrationDurationMs: json.durationMs ?? null,
            narrationScript: script,
            narrationTimestamps: json.timestamps ?? null,
          });
        }
      } catch {
        // Preview narration failure is non-blocking — compose retries at download.
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const petName = state.petName || 'them';

  const eulogyText = composeEulogy(state);

  function handleRestart() {
    update({ ...initialState });
  }

  // Shared helper: compose the tribute video and return its URL.
  // Throws on any failure so callers can handle errors uniformly.
  async function composeVideo(onPhase?: (phase: string) => void): Promise<string> {
    if (Object.keys(state.beatVideos).length === 0) {
      throw new Error('Still rendering — try again in a moment.');
    }
    if (state.words.narration !== 'off' && !state.cardPreviewImages.opening) {
      throw new Error('Card images are still being generated — please wait a moment and try again.');
    }
    // Re-mix bypasses the composeReady gate, so guard here too: never assemble a
    // silent video while the chosen music bed is still being generated.
    if (presetBedPending(state)) {
      throw new Error('Your music is still being prepared — please wait a moment and try again.');
    }

    const musicUrl = state.musicBedUrl ?? null;

    // Reuse the voiceover already generated on mount; only generate here if the
    // mount effect hasn't finished (or failed).
    let narrationUrl: string | null = state.narrationUrl ?? null;
    let narrationDurationMs: number | null = state.narrationDurationMs ?? null;
    let narrationScript: string | null = state.narrationScript ?? null;
    let narrationTimestamps: NarrationWord[] | null = state.narrationTimestamps ?? null;
    if (state.words.narration !== 'off' && !narrationUrl) {
      onPhase?.('Preparing the narration…');
      const script = await composeNarrationScript(state);
      if (!script) {
        throw new Error('Could not compose a narration script — please fill in at least a pet name.');
      }
      narrationScript = script;
      const chosenVoice = narrationVoices.find((v) => v.id === state.words.narration);
      const elevenVoice = chosenVoice?.elevenVoice ?? 'Rachel';
      const nRes = await fetch('/api/video/narration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: script, voice: elevenVoice }),
      });
      if (nRes.ok) {
        const nJson = (await nRes.json()) as { url?: string; durationMs?: number; timestamps?: NarrationWord[] | null };
        narrationUrl = nJson.url ?? null;
        narrationDurationMs = nJson.durationMs ?? null;
        narrationTimestamps = nJson.timestamps ?? null;
        if (narrationUrl) update({ narrationUrl, narrationDurationMs, narrationScript: script, narrationTimestamps });
      } else {
        const nErr = (await nRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(`Narration failed: ${nErr.error ?? nRes.statusText}`);
      }
    }

    const aspectRatioMap: Record<string, '9:16' | '16:9' | '1:1'> = {
      '9:16': '9:16',
      '16:9': '16:9',
      '1:1': '1:1',
      'all_three': '9:16',
    };
    const aspectRatio = aspectRatioMap[state.aspectRatio] ?? '9:16';

    const hasOverlays = Object.keys(state.captionOverlayImages).length > 0;
    const burnedVideoMap: Record<number, string> = {};
    let burnSucceeded = false;

    // Skip the burn-captions step entirely when narration is off — the burned
    // captions wouldn't be used in the final video anyway.
    if (hasOverlays && state.words.narration !== 'off') {
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
        // ffmpeg not installed — fall through to P0
      }
    }

    // Caption cards are a narration-only feature. When narration is off,
    // we never insert per-beat caption cards (opening + closing cards are
    // unconditional — they're added at the start and end regardless).
    const narrationOn = state.words.narration !== 'off';
    const captionCardCount = (!narrationOn || burnSucceeded) ? 0 : Object.keys(state.captionCardImages).length;
    const cardsSeconds = 6 + captionCardCount * 2.5;
    const beatLength = state.beatSheet.length || 1;
    // When the audio sets the tribute's length (lyric song or uploaded audio),
    // size the beats from that master duration; otherwise from the Stage 2.5 pick.
    // Seedance's 15s-per-clip cap and a 4s floor still apply.
    const masterSeconds = state.lockedDurationSeconds && state.lockedDurationSeconds > 0
      ? state.lockedDurationSeconds
      : state.targetMinutes * 60;
    const perBeatSeconds = Math.min(
      15,
      Math.max(4, Math.round((masterSeconds - cardsSeconds) / beatLength))
    );
    const perBeatMs = perBeatSeconds * 1000;
    const composeBeatVideoMap = burnSucceeded ? burnedVideoMap : state.beatVideos;

    const subtitlesEnabled =
      state.words.narration !== 'off' &&
      state.words.subtitles === true &&
      narrationScript !== null;

    onPhase?.('Assembling your tribute…');
    const res = await fetch('/api/video/compose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        openingCardUrl: state.cardPreviewImages.opening,
        closingCardUrl: state.cardPreviewImages.closing,
        beats: state.beatSheet.map((beat) => ({
          index: beat.index,
          videoUrl: composeBeatVideoMap[beat.index] ?? state.beatVideos[beat.index],
          captionCardUrl: (!narrationOn || burnSucceeded) ? undefined : state.captionCardImages[beat.index],
        })),
        aspectRatio,
        perBeatMs,
        narrationUrl: narrationUrl || null,
        narrationDurationMs: narrationDurationMs ?? undefined,
        musicUrl: musicUrl || null,
        lockedDurationSeconds: state.lockedDurationSeconds ?? undefined,
        subtitlesEnabled,
        narrationScript: subtitlesEnabled ? narrationScript : null,
        narrationTimestamps: subtitlesEnabled ? narrationTimestamps : null,
      }),
    });
    const json = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !json.url) {
      throw new Error(json.error ?? 'Assembly failed');
    }
    update({ assembledVideoUrl: json.url });
    return json.url;
  }

  // Readiness gate — only assemble once every timeline input exists. This is
  // what prevents the music race (composing before the Suno bed arrives → a
  // silent video) and the "card images still generating" failure.
  const beatsReady =
    state.beatSheet.length > 0 && state.beatSheet.every((b) => !!state.beatVideos[b.index]);
  const narrationReady = state.words.narration === 'off' || !!state.narrationUrl;
  const cardsReady = state.words.narration === 'off' || !!state.cardPreviewImages.opening;
  // Ready unless a preset bed is still pending (upload/lyric/custom/ambient/
  // silence don't block). Without this, those modes would never auto-compose.
  const musicReady = !presetBedPending(state);
  const composeReady = beatsReady && narrationReady && cardsReady && musicReady;

  // Run the compose. force=true re-mixes even when a previous cut exists.
  async function runCompose(force: boolean): Promise<string | null> {
    if (!force && state.assembledVideoUrl) {
      setComposeStatus('idle');
      return state.assembledVideoUrl;
    }
    setComposeError(null);
    setComposePhase('Assembling your tribute…');
    setComposeStatus('composing');
    try {
      const url = await composeVideo((p) => setComposePhase(p));
      setComposeStatus('idle');
      return url;
    } catch (err) {
      setComposeError(err instanceof Error ? err.message : 'Could not assemble the video.');
      setComposeStatus('error');
      return null;
    }
  }

  // Assemble the real MP4 on arrival, once all inputs are ready. Single-fire;
  // a user re-mix (or going back to edit and returning) goes through the button.
  useEffect(() => {
    if (previewMode) return;
    if (state.assembledVideoUrl) return; // already assembled — the player shows it
    if (composeStartedRef.current) return;
    if (!composeReady) return;
    composeStartedRef.current = true;
    // Defer out of the effect's synchronous body so the compose's setState
    // calls don't cascade renders during commit.
    queueMicrotask(() => { void runCompose(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewMode, composeReady, state.assembledVideoUrl]);

  // Re-mix: re-run the assembly on the EXISTING clips (no fal re-roll). Cheap —
  // mirrors builder.blck's reassembleShow. Used after editing a scene/storyboard
  // or to pick up a freshly-arrived music bed.
  async function handleRemix() {
    await runCompose(true);
  }

  function startProgressRamp() {
    setDownloadProgress(5);
    if (downloadTimerRef.current) clearInterval(downloadTimerRef.current);
    downloadTimerRef.current = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 92) return prev;
        // Ease: larger steps early, smaller steps as we approach the cap.
        const remaining = 92 - prev;
        const step = Math.max(0.15, remaining * 0.018);
        return Math.min(92, prev + step);
      });
    }, 400);
  }

  function stopProgressRamp() {
    if (downloadTimerRef.current) {
      clearInterval(downloadTimerRef.current);
      downloadTimerRef.current = null;
    }
  }

  async function handleDownload() {
    setDownloadError(null);
    setDownloadProgress(0);
    setDownloadPhase('Preparing your tribute…');
    setDownloadStatus('preparing');
    startProgressRamp();
    try {
      // Download the exact file the player is showing; only compose if none
      // exists yet (e.g. download clicked before the auto-assemble finished).
      const videoUrl =
        state.assembledVideoUrl ?? (await composeVideo((phase) => setDownloadPhase(phase)));
      stopProgressRamp();
      setDownloadPhase('Downloading…');
      setDownloadProgress(95);
      const videoBlob = await fetch(videoUrl).then((r) => r.blob());
      setDownloadProgress(100);
      const objectUrl = URL.createObjectURL(videoBlob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${petName}-tribute.mp4`;
      a.click();
      URL.revokeObjectURL(objectUrl);
      setDownloadStatus('done');
      setTimeout(() => {
        setDownloadProgress(0);
        setDownloadPhase('');
      }, 1200);
    } catch (err) {
      stopProgressRamp();
      setDownloadProgress(0);
      setDownloadPhase('');
      setDownloadError(err instanceof Error ? err.message : 'Download failed');
      setDownloadStatus('error');
    }
  }

  async function handleShare() {
    setShareError(null);
    setShareLink(null);
    setShareStatus('preparing');
    try {
      const videoUrl = state.assembledVideoUrl ?? (await composeVideo());
      const res = await fetch('/api/tribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          petName: state.petName || 'Unknown',
          videoUrl,
          openingText: state.cardText.opening || undefined,
          closingText: state.cardText.closing || undefined,
          years: state.yearsIncluded && state.years ? state.years : undefined,
          creatorName: state.creatorName || undefined,
        }),
      });
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !json.id) {
        throw new Error(json.error ?? 'Could not create memorial page');
      }
      setShareLink(`${window.location.origin}/tribute/${json.id}`);
      setShareStatus('done');
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Share failed');
      setShareStatus('error');
    }
  }

  async function handleCopyLink() {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // fallback: select the text manually
    }
  }

  const navLinkStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    background: 'transparent',
    border: 'none',
    color: PALETTE.mute,
    fontFamily: 'Inter, sans-serif',
    fontSize: 13,
    cursor: 'pointer',
    padding: 0,
  };

  return (
    <section style={{ paddingTop: 16 }}>
      {/* Back navigation — return to earlier steps to refine, then re-mix.
          Going back is non-destructive: rendered clips are preserved. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 18 }}>
        <button onClick={onBack} style={navLinkStyle}>
          <ChevronLeft size={15} /> Back
        </button>
        <button onClick={() => goToStep('storyboard')} style={{ ...navLinkStyle, textDecoration: 'underline', textUnderlineOffset: 4 }}>
          <Pencil size={13} /> Edit the storyboard
        </button>
      </div>

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

      {/* Tribute player — plays the real composed MP4 */}
      <div style={{ marginTop: 32 }}>
        <TributePlayer
          assembledUrl={state.assembledVideoUrl}
          composing={composeStatus === 'composing'}
          phase={composePhase}
          error={composeStatus === 'error' ? composeError : null}
          onRemix={handleRemix}
        />
      </div>

      {/* Re-mix — re-assemble the existing clips (e.g. after editing a scene or
          the storyboard, or to pick up a freshly-generated music bed). */}
      <div style={{ marginTop: 14, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <PrimaryButton onClick={handleRemix} disabled={composeStatus === 'composing'} secondary small>
          <RotateCw size={13} /> {composeStatus === 'composing' ? 'Re-mixing…' : 'Re-mix the video'}
        </PrimaryButton>
        <Sans style={{ fontSize: 12, color: PALETTE.mute, lineHeight: 1.4 }}>
          Edited a scene or the storyboard? Re-mix to refresh your video.
        </Sans>
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
      </div>

      {/* Download progress bar */}
      {downloadStatus === 'preparing' && (
        <div style={{ marginTop: 14, maxWidth: 420 }}>
          <div
            style={{
              height: 3,
              background: PALETTE.parchmentLight,
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${downloadProgress}%`,
                background: PALETTE.brass,
                borderRadius: 2,
                transition: 'width 400ms ease-out',
              }}
            />
          </div>
          {downloadPhase && (
            <Sans style={{ fontSize: 12, color: PALETTE.mute, marginTop: 6, letterSpacing: '0.04em' }}>
              {downloadPhase}
            </Sans>
          )}
        </div>
      )}

      <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <PrimaryButton onClick={handleShare} disabled={shareStatus === 'preparing'} secondary>
          {shareStatus === 'preparing' ? 'Creating your page…' : 'Get my memorial page link'}
        </PrimaryButton>
        <PrimaryButton onClick={() => {}} secondary>
          Add to family channel
        </PrimaryButton>
      </div>

      {/* Share panel */}
      {(shareStatus === 'done' || shareStatus === 'error') && (
        <div
          style={{
            marginTop: 20,
            padding: '18px 20px',
            background: shareStatus === 'error' ? '#FEF2F2' : PALETTE.boneSoft,
            border: `1px solid ${shareStatus === 'error' ? '#FCA5A5' : PALETTE.parchmentLight}`,
            borderRadius: 4,
            maxWidth: 520,
          }}
        >
          {shareStatus === 'error' && shareError && (
            <Sans style={{ fontSize: 14, color: '#B91C1C', lineHeight: 1.5 }}>
              {shareError}
            </Sans>
          )}
          {shareStatus === 'done' && shareLink && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Eyebrow>Your memorial page</Eyebrow>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Sans
                  as="a"
                  href={shareLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 14,
                    color: PALETTE.espressoSoft,
                    wordBreak: 'break-all',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {shareLink}
                </Sans>
                <button
                  onClick={handleCopyLink}
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 12,
                    letterSpacing: '0.06em',
                    padding: '6px 14px',
                    border: `1px solid ${PALETTE.espresso}`,
                    background: shareCopied ? PALETTE.espresso : 'transparent',
                    color: shareCopied ? PALETTE.bone : PALETTE.espresso,
                    borderRadius: 2,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 180ms ease',
                  }}
                >
                  {shareCopied ? 'Copied!' : 'Copy link'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
