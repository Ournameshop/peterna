"use client";

import { useMemo, type CSSProperties } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";
import { VIDEO_RENDER, substitutePetName } from "@/lib/library/copy";
import type {
  BeatWire,
  StoryboardFrameWire,
  VideoClipStatus,
  VideoClipWire,
} from "@/lib/builder/wire-types";
import NotificationOptIn from "./NotificationOptIn";

// Stage 6 — Video render progress.
//
// The user lands here right after cinematography is approved. BuilderClient
// fires POST /api/video/render, then starts polling GET /api/video/status
// every 5s; this view reads from a per-clip array and renders a grid card
// per beat with status badge + storyboard thumbnail.
//
// The grid never collapses on missing data — until a beat has a clip in the
// array, we render a placeholder card in `queued` state derived from the
// storyboard frame. That way the user sees the full plan immediately, not a
// blank page that fills in card-by-card.
//
// Failed clips show a "Try again" pill which calls onReroll(beat_idx). We
// frame the reroll as "Let's try that scene again" — never cost-pressure.
// Done clips also accept an optional reroll ("Try this scene differently")
// but it's de-emphasized; the assumption is the user will only reroll on
// failure unless something looks clearly off.

type Props = {
  petName: string | null;
  /** The canonical clip array from the latest poll. May be null until the
   *  first poll lands (we still render the grid using storyboard frames). */
  clips: ReadonlyArray<VideoClipWire> | null;
  /** Beats + storyboard frames drive the grid skeleton — one card per beat,
   *  in order, with the storyboard thumbnail as the static still. */
  beats: ReadonlyArray<BeatWire>;
  storyboardFrames: ReadonlyArray<StoryboardFrameWire> | null;
  /** Session aspect ratio — drives the card's visible frame shape. */
  aspectRatio?: string | null;
  /** Disabled while a global side-effect is in flight (approve, assembly
   *  kick-off, etc.). The per-card reroll button reads from here too. */
  disabled?: boolean;
  /** Beat index currently being rerolled (UI guard). */
  rerollBeatIdx?: number | null;
  /** Called on tap of a card's "Try again" pill. */
  onRerollClip: (beatIdx: number) => void;
  /** Session id — forwarded to the push opt-in so anonymous subscriptions
   *  are scoped before any auth_user is attached. Omit to skip the prompt
   *  (e.g. if we don't have a session yet, which shouldn't happen on this view). */
  sessionId?: string | null;
};

export default function VideoRenderProgress({
  petName,
  clips,
  beats,
  storyboardFrames,
  aspectRatio,
  disabled = false,
  rerollBeatIdx = null,
  onRerollClip,
  sessionId = null,
}: Props) {
  const headline = substitutePetName(VIDEO_RENDER.headline, petName);

  // Index lookups for O(1) joins between beats / clips / frames.
  const clipByIdx = useMemo(() => {
    const map = new Map<number, VideoClipWire>();
    (clips ?? []).forEach((c) => map.set(c.beat_idx, c));
    return map;
  }, [clips]);
  const frameByIdx = useMemo(() => {
    const map = new Map<number, StoryboardFrameWire>();
    (storyboardFrames ?? []).forEach((f) => map.set(f.beat_idx, f));
    return map;
  }, [storyboardFrames]);

  const total = beats.length;
  const doneCount = useMemo(
    () => (clips ?? []).filter((c) => c.status === "done").length,
    [clips],
  );
  const progressLine = VIDEO_RENDER.progress_template
    .replace("[N]", String(doneCount))
    .replace("[M]", String(total));

  // Show the push opt-in only when there's actually a render in flight — i.e.
  // the user has at least one beat queued. Suppress on empty grids.
  const showOptIn = beats.length > 0 && sessionId !== null;

  return (
    <section aria-label="Video render progress" style={wrap}>
      <header style={headerWrap}>
        <h2 style={headlineStyle}>{headline}</h2>
        <p style={subheadStyle}>{VIDEO_RENDER.subhead}</p>
      </header>

      {showOptIn ? (
        <NotificationOptIn petName={petName} sessionId={sessionId} />
      ) : null}

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={progressRow}
      >
        <ProgressBar value={doneCount} max={total} />
        <p style={progressLabel}>{progressLine}</p>
      </div>

      {total === 0 ? (
        <p style={emptyState}>
          No beats to render. Tap &ldquo;Start over&rdquo; in an earlier step.
        </p>
      ) : (
        <ol style={gridStyle} aria-label="Video clips by scene">
          {beats.map((beat) => {
            const clip = clipByIdx.get(beat.idx) ?? null;
            const frame = frameByIdx.get(beat.idx) ?? null;
            const isRerolling = rerollBeatIdx === beat.idx;
            const status: VideoClipStatus = clip?.status ?? "queued";
            return (
              <li key={beat.idx} style={gridItem}>
                <ClipCard
                  beat={beat}
                  total={total}
                  frame={frame}
                  status={status}
                  aspectRatio={aspectRatio}
                  isRerolling={isRerolling}
                  disabled={disabled || rerollBeatIdx !== null}
                  errorHint={clip?.error}
                  onReroll={() => onRerollClip(beat.idx)}
                />
              </li>
            );
          })}
        </ol>
      )}

      <p style={pollingHint}>{VIDEO_RENDER.polling_hint}</p>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Per-clip card
// -----------------------------------------------------------------------------

function ClipCard({
  beat,
  total,
  frame,
  status,
  aspectRatio,
  isRerolling,
  disabled,
  errorHint,
  onReroll,
}: {
  beat: BeatWire;
  total: number;
  frame: StoryboardFrameWire | null;
  status: VideoClipStatus;
  aspectRatio?: string | null;
  isRerolling: boolean;
  disabled: boolean;
  errorHint?: string;
  onReroll: () => void;
}) {
  const sceneLabel = VIDEO_RENDER.scene_label_template
    .replace("[N]", String(beat.idx + 1))
    .replace("[M]", String(total));
  const cardAria = VIDEO_RENDER.card_aria_template
    .replace("[N]", String(beat.idx + 1))
    .replace("[M]", String(total))
    .replace("[STATUS]", VIDEO_RENDER.status_labels[status]);

  const aspectCss = (aspectRatio ?? "1:1").replace(":", " / ");
  const isFailed = status === "failed";
  const isDone = status === "done";

  return (
    <article aria-label={cardAria} style={cardWrap}>
      <div style={{ ...frameBox, aspectRatio: aspectCss }}>
        {frame ? (
          <Image
            src={frame.public_url}
            alt={`Storyboard for ${sceneLabel}: ${beat.caption || "scene"}`}
            fill
            sizes="(max-width: 480px) 100vw, (max-width: 1080px) 50vw, 25vw"
            loading="lazy"
            style={{
              objectFit: "cover",
              opacity: isDone ? 1 : 0.55,
              filter: isDone ? "none" : "saturate(0.85)",
            }}
            unoptimized
          />
        ) : (
          <p style={preparingText}>Preparing scene {beat.idx + 1}…</p>
        )}

        <ClipStatusOverlay
          status={status}
          isRerolling={isRerolling}
          sceneNumber={beat.idx + 1}
        />
      </div>

      <header style={headerRow}>
        <span style={sceneLabelStyle}>{sceneLabel}</span>
        <StatusBadge status={status} isRerolling={isRerolling} />
      </header>

      {isFailed && errorHint ? (
        <p style={errorHintStyle} aria-live="polite">
          {errorHint}
        </p>
      ) : null}

      {(isFailed || isDone) && !isRerolling ? (
        <motion.button
          type="button"
          onClick={onReroll}
          disabled={disabled}
          whileHover={!disabled ? { scale: 1.02 } : {}}
          whileTap={!disabled ? { scale: 0.98 } : {}}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          style={isFailed ? rerollFailedBtn(disabled) : rerollOptionalBtn(disabled)}
        >
          {isFailed ? VIDEO_RENDER.reroll_failed : VIDEO_RENDER.reroll_optional}
        </motion.button>
      ) : null}
    </article>
  );
}

// -----------------------------------------------------------------------------
// Overlay shown on top of the storyboard thumbnail while the clip is queued
// or rendering. Done clips get a small "Done" check mark in the badge row —
// no overlay (the thumbnail is the visual reward).
// -----------------------------------------------------------------------------

function ClipStatusOverlay({
  status,
  isRerolling,
  sceneNumber,
}: {
  status: VideoClipStatus;
  isRerolling: boolean;
  sceneNumber: number;
}) {
  if (isRerolling) {
    const line = VIDEO_RENDER.reroll_in_flight.replace(
      "[N]",
      String(sceneNumber),
    );
    return (
      <div style={overlay} aria-hidden="true">
        <div style={spinnerStyle} />
        <p style={overlayLine}>{line}</p>
        <style>{`@keyframes peternaSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  if (status === "rendering") {
    return (
      <div style={overlay} aria-hidden="true">
        <div style={spinnerStyle} />
        <p style={overlayLine}>Rendering…</p>
        <style>{`@keyframes peternaSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  if (status === "queued") {
    return (
      <div style={overlay} aria-hidden="true">
        <p style={overlayLine}>Queued</p>
      </div>
    );
  }
  return null;
}

// -----------------------------------------------------------------------------
// Status badge — small, scannable, color-coded.
// -----------------------------------------------------------------------------

function StatusBadge({
  status,
  isRerolling,
}: {
  status: VideoClipStatus;
  isRerolling: boolean;
}) {
  const label = isRerolling
    ? VIDEO_RENDER.status_labels.rendering
    : VIDEO_RENDER.status_labels[status];
  const tone = isRerolling ? "rendering" : status;
  return (
    <span style={badgeStyle(tone)} aria-label={`Status: ${label}`}>
      {tone === "done" ? <CheckIcon /> : null}
      {label}
    </span>
  );
}

function CheckIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      aria-hidden="true"
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <path
        d="M2 6.5L4.8 9.2L10 3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// -----------------------------------------------------------------------------
// Progress bar — slim, deliberately quiet. The grid is the headline; this is
// a glanceable summary.
// -----------------------------------------------------------------------------

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={`${value} of ${max} scenes done`}
      style={progressTrack}
    >
      <div style={{ ...progressFill, width: `${pct}%` }} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Styles — inline + tokens only, no Tailwind / CSS modules.
// -----------------------------------------------------------------------------

const wrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 22,
  width: "100%",
  maxWidth: 1080,
  marginLeft: "auto",
  marginRight: "auto",
};

const headerWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  textAlign: "center",
};

const headlineStyle: CSSProperties = {
  margin: 0,
  fontFamily: FONT_DISPLAY,
  fontStyle: "italic",
  fontSize: 30,
  lineHeight: 1.3,
  color: C.ink,
  fontWeight: 400,
  letterSpacing: "-0.005em",
};

const subheadStyle: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 14,
  color: C.inkSofter,
  lineHeight: 1.55,
  maxWidth: 620,
  marginLeft: "auto",
  marginRight: "auto",
};

const progressRow: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  width: "100%",
  maxWidth: 480,
  marginLeft: "auto",
  marginRight: "auto",
};

const progressTrack: CSSProperties = {
  width: "100%",
  height: 6,
  borderRadius: 999,
  background: "rgba(0,0,0,0.06)",
  overflow: "hidden",
};

const progressFill: CSSProperties = {
  height: "100%",
  background: C.goldDeep,
  borderRadius: 999,
  transition: "width 400ms ease-out",
};

const progressLabel: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 13,
  color: C.inkSoft,
  letterSpacing: "0.02em",
};

const gridStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: 18,
  width: "100%",
};

const gridItem: CSSProperties = {
  width: "100%",
  display: "flex",
};

const cardWrap: CSSProperties = {
  background: "#FFFBF3",
  border: `1px solid ${C.line}`,
  borderRadius: 18,
  padding: "12px 12px 14px",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  width: "100%",
  alignSelf: "stretch",
};

const frameBox: CSSProperties = {
  width: "100%",
  position: "relative",
  borderRadius: 12,
  overflow: "hidden",
  background: "#FFFBF3",
  border: `1px solid ${C.line}`,
};

const overlay: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  background: "rgba(42, 33, 27, 0.42)",
  color: C.cream,
  fontFamily: FONT_SANS,
  fontSize: 12,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const overlayLine: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const spinnerStyle: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: "50%",
  border: "2px solid rgba(255,255,255,0.25)",
  borderTopColor: C.cream,
  animation: "peternaSpin 900ms linear infinite",
};

const headerRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  paddingTop: 2,
};

const sceneLabelStyle: CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontStyle: "italic",
  fontSize: 15,
  lineHeight: 1.2,
  color: C.ink,
  fontWeight: 400,
  letterSpacing: "-0.005em",
};

function badgeStyle(tone: VideoClipStatus): CSSProperties {
  const palette: Record<VideoClipStatus, { bg: string; fg: string }> = {
    queued: { bg: "rgba(0,0,0,0.05)", fg: C.inkSofter },
    rendering: { bg: "rgba(201, 169, 97, 0.18)", fg: C.goldDeep },
    done: { bg: "rgba(143, 166, 142, 0.22)", fg: "#3F5740" },
    failed: { bg: "rgba(168, 60, 60, 0.14)", fg: "#8A3737" },
  };
  const p = palette[tone];
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 9px",
    borderRadius: 999,
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    background: p.bg,
    color: p.fg,
    whiteSpace: "nowrap",
  };
}

const errorHintStyle: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 12,
  color: "#8A3737",
  lineHeight: 1.5,
};

const preparingText: CSSProperties = {
  margin: 0,
  padding: 16,
  textAlign: "center",
  fontFamily: FONT_SANS,
  fontSize: 13,
  color: C.inkSofter,
  fontStyle: "italic",
};

const pollingHint: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 12,
  color: C.inkSofter,
  textAlign: "center",
  letterSpacing: "0.02em",
};

const emptyState: CSSProperties = {
  margin: 0,
  padding: "40px 16px",
  textAlign: "center",
  fontFamily: FONT_SANS,
  fontSize: 14,
  color: C.inkSofter,
};

function rerollFailedBtn(disabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 14px",
    borderRadius: 999,
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: 500,
    border: "none",
    background: C.ink,
    color: C.cream,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    letterSpacing: "0.01em",
    marginTop: 2,
    alignSelf: "stretch",
  };
}

function rerollOptionalBtn(disabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 14px",
    borderRadius: 999,
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: 500,
    border: `1px solid ${C.line}`,
    background: "transparent",
    color: C.inkSoft,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    letterSpacing: "0.01em",
    marginTop: 2,
    alignSelf: "stretch",
  };
}
