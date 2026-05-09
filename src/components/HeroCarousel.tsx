"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { C } from "@/lib/peterna-tokens";

export type HeroCarouselSlide = {
  src: string;
  alt: string;
  poster?: string;
};

type Props = {
  slides: HeroCarouselSlide[];
  /** ms per slide (default 6000) */
  intervalMs?: number;
  /** crossfade duration in seconds (default 1.2) */
  fadeSec?: number;
  /** ken-burns scale multiplier end value (default 1.06) */
  kenBurnsTo?: number;
};

/**
 * HeroCarousel — full-bleed background carousel of stills for the home hero.
 *
 * Cadence (locked by Andre):
 *  - 6s per slide auto-advance
 *  - 1.2s pure opacity crossfade between slides (no slide/swipe motion)
 *  - Ken-burns: scale 1.00 → 1.06 over the full 6s on the active slide
 *  - Pause on hover (desktop)
 *  - prefers-reduced-motion → no auto-advance, no zoom; first slide only (still)
 *  - Touch swipe to advance/go-back on touch devices
 *  - Tiny dot indicators at the bottom (clickable)
 *  - No prev/next arrow chrome (memorial vibe — quiet)
 *
 * Stacking is managed by the parent: this component renders a positioned layer
 * (absolute, z-index: -3) so the dark warm gradient + radial gold tint in the
 * parent (z-index: -1) and the page content (z-index: auto) stay on top.
 */
export default function HeroCarousel({
  slides,
  intervalMs = 6000,
  fadeSec = 1.2,
  kenBurnsTo = 1.06,
}: Props) {
  const prefersReducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = slides.length;

  const goTo = useCallback(
    (next: number) => {
      if (total === 0) return;
      const wrapped = ((next % total) + total) % total;
      setIndex(wrapped);
    },
    [total],
  );

  // Auto-advance
  useEffect(() => {
    if (prefersReducedMotion) return;
    if (paused) return;
    if (total <= 1) return;
    const id = window.setTimeout(() => {
      setIndex((i) => (i + 1) % total);
    }, intervalMs);
    return () => window.clearTimeout(id);
  }, [index, paused, prefersReducedMotion, intervalMs, total]);

  // Touch swipe (lightweight handler — no drag chrome)
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null || touchStartY.current == null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX.current;
    const dy = t.clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    // Only treat as a swipe if mostly horizontal and over threshold
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      goTo(index + (dx < 0 ? 1 : -1));
    }
  };

  // In reduced-motion mode, force first slide and disable everything dynamic.
  const activeIndex = prefersReducedMotion ? 0 : index;
  const activeSlide = slides[activeIndex];

  if (!activeSlide) return null;

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Real pet life moments"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: -3,
        overflow: "hidden",
        background: "#1A1410",
        pointerEvents: "auto",
      }}
    >
      {/* Crossfade stack: AnimatePresence with mode="sync" so old + new slides
          overlap during the 1.2s fade with no flash of background. */}
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={activeIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: fadeSec, ease: "linear" }}
          style={{
            position: "absolute",
            inset: 0,
            willChange: "opacity",
          }}
          aria-roledescription="slide"
          aria-label={`Slide ${activeIndex + 1} of ${total}`}
        >
          {/* Ken-burns wrapper — slow zoom 1.00 → kenBurnsTo over the slide's
              active duration. Disabled under reduced motion. */}
          <motion.div
            initial={{ scale: 1.0 }}
            animate={{ scale: prefersReducedMotion ? 1.0 : kenBurnsTo }}
            transition={{
              duration: prefersReducedMotion ? 0 : intervalMs / 1000,
              ease: "linear",
            }}
            style={{
              position: "absolute",
              inset: 0,
              willChange: "transform",
            }}
          >
            <Image
              src={activeSlide.src}
              alt={activeSlide.alt}
              fill
              priority={activeIndex === 0}
              sizes="100vw"
              style={{
                objectFit: "cover",
              }}
            />
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Polite live region for screen-reader slide announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {`Slide ${activeIndex + 1} of ${total}: ${activeSlide.alt}`}
      </div>

      {/* Dot indicators */}
      {total > 1 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 24,
            display: "flex",
            justifyContent: "center",
            gap: 10,
            zIndex: 2,
            pointerEvents: "auto",
          }}
        >
          {slides.map((_, i) => {
            const active = i === activeIndex;
            return (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1} of ${total}`}
                aria-current={active ? "true" : undefined}
                style={{
                  width: 6,
                  height: 6,
                  padding: 0,
                  borderRadius: "50%",
                  border: "none",
                  background: active ? C.cream : "rgba(248,241,228,0.3)",
                  cursor: "pointer",
                  transition: "background 0.4s ease",
                  outline: "none",
                  boxShadow: active ? "0 0 0 1px rgba(0,0,0,0.18)" : "none",
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
