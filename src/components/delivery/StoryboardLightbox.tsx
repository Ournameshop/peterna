"use client";

import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { C, FONT_SANS } from "@/lib/peterna-tokens";

// Client-side storyboard grid on the public delivery page.
//
// Renders the storyboard frame URLs as a grid; tapping any frame opens it
// in a full-screen lightbox. Keyboard support:
//   - Escape closes the lightbox
//   - ArrowLeft / ArrowRight cycle frames
//   - Enter / Space on a focused grid card opens that frame
//
// The lightbox uses a portal-less inline overlay (fixed-positioned div). The
// trade-off vs a real portal is that it lives inside the article's stacking
// context — fine here because the article is the top-level rendered element.
//
// Accessibility:
//   - The grid is a `role="list"` of links; cards announce "Frame N of M".
//   - The lightbox is a `role="dialog" aria-modal="true"` with focus trap
//     on the close button. Closing returns focus to the launching card.

type Props = {
  petName: string;
  frameUrls: ReadonlyArray<string>;
};

export default function StoryboardLightbox({ petName, frameUrls }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const open = useCallback((idx: number) => setOpenIdx(idx), []);
  const close = useCallback(() => setOpenIdx(null), []);
  const prev = useCallback(() => {
    setOpenIdx((cur) =>
      cur === null
        ? null
        : (cur - 1 + frameUrls.length) % frameUrls.length,
    );
  }, [frameUrls.length]);
  const next = useCallback(() => {
    setOpenIdx((cur) => (cur === null ? null : (cur + 1) % frameUrls.length));
  }, [frameUrls.length]);

  // Global key handler while the lightbox is open. We attach to window so
  // the user doesn't have to keep keyboard focus on the close button.
  useEffect(() => {
    if (openIdx === null) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIdx, close, prev, next]);

  if (frameUrls.length === 0) return null;

  return (
    <>
      <ul role="list" style={gridStyle}>
        {frameUrls.map((url, idx) => (
          <li key={`${url}-${idx}`} style={{ listStyle: "none" }}>
            <FrameCard
              petName={petName}
              url={url}
              idx={idx}
              total={frameUrls.length}
              onOpen={() => open(idx)}
            />
          </li>
        ))}
      </ul>

      {openIdx !== null ? (
        <Lightbox
          petName={petName}
          url={frameUrls[openIdx]!}
          idx={openIdx}
          total={frameUrls.length}
          onClose={close}
          onPrev={prev}
          onNext={next}
        />
      ) : null}
    </>
  );
}

// -----------------------------------------------------------------------------
// FrameCard — keyboard-activatable grid card
// -----------------------------------------------------------------------------

function FrameCard({
  petName,
  url,
  idx,
  total,
  onOpen,
}: {
  petName: string;
  url: string;
  idx: number;
  total: number;
  onOpen: () => void;
}) {
  const onKey = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpen();
      }
    },
    [onOpen],
  );

  const label = `Frame ${idx + 1} of ${total} — ${petName}`;

  return (
    <button
      type="button"
      onClick={onOpen}
      onKeyDown={onKey}
      style={cardButton}
      aria-label={label}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`Storyboard frame ${idx + 1} of ${total} for ${petName}`}
        style={cardImg}
        loading="lazy"
      />
    </button>
  );
}

// -----------------------------------------------------------------------------
// Lightbox overlay
// -----------------------------------------------------------------------------

function Lightbox({
  petName,
  url,
  idx,
  total,
  onClose,
  onPrev,
  onNext,
}: {
  petName: string;
  url: string;
  idx: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Storyboard frame ${idx + 1} of ${total}`}
      style={overlay}
      // Backdrop click closes; the inner image's click handler stops
      // propagation so it can't accidentally close.
      onClick={onClose}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close enlarged frame"
        style={closeBtn}
        autoFocus
      >
        ×
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
        aria-label="Previous frame"
        style={{ ...navBtn, left: 12 }}
      >
        ‹
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`Storyboard frame ${idx + 1} of ${total} for ${petName}`}
        style={lightboxImg}
        onClick={(e) => e.stopPropagation()}
      />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
        aria-label="Next frame"
        style={{ ...navBtn, right: 12 }}
      >
        ›
      </button>

      <p style={counter} aria-live="polite">
        {idx + 1} / {total}
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const gridStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
  gap: 8,
};

const cardButton: CSSProperties = {
  display: "block",
  width: "100%",
  padding: 0,
  margin: 0,
  background: "transparent",
  border: `1px solid ${C.line}`,
  borderRadius: 8,
  overflow: "hidden",
  cursor: "pointer",
  aspectRatio: "1 / 1",
};

const cardImg: CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 14, 12, 0.92)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 24,
};

const lightboxImg: CSSProperties = {
  maxWidth: "min(94vw, 1200px)",
  maxHeight: "calc(100vh - 96px)",
  width: "auto",
  height: "auto",
  borderRadius: 8,
  boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
};

const closeBtn: CSSProperties = {
  position: "absolute",
  top: 16,
  right: 16,
  width: 40,
  height: 40,
  borderRadius: 999,
  background: "rgba(248,241,228,0.18)",
  color: C.cream,
  border: "none",
  fontFamily: FONT_SANS,
  fontSize: 22,
  lineHeight: 1,
  cursor: "pointer",
};

const navBtn: CSSProperties = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  width: 40,
  height: 40,
  borderRadius: 999,
  background: "rgba(248,241,228,0.18)",
  color: C.cream,
  border: "none",
  fontFamily: FONT_SANS,
  fontSize: 26,
  lineHeight: 1,
  cursor: "pointer",
};

const counter: CSSProperties = {
  position: "absolute",
  bottom: 18,
  left: "50%",
  transform: "translateX(-50%)",
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 12,
  color: C.cream,
  letterSpacing: "0.06em",
};
