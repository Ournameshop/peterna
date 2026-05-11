"use client";

// HeroFeaturedBackground — full-bleed hero background that mirrors the
// currently-featured pet in <FeaturedPortrait>, blurred + darkened.
//
// Replaces the previous <HeroCarousel> which ran an independent 6-slide
// Gemini-stills carousel on a different rhythm — that produced the bug
// Andre flagged (2026-05-11): "the hero background image and the main
// photo are different. Is that intentional?" — they were two different
// animals. With this component the background IS the same image as the
// foreground card, blurred so the foreground stays the focal point.
//
// Reads from <FeaturedPetRotationProvider>. Renders at z-index: -3 so
// the existing dark warm + radial gold overlays in page.tsx (z-index: -1)
// stack correctly on top.

import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useFeaturedPetRotation } from "@/lib/featured-pet-rotation";

// Per-pet anchor for cover-cropping the wide samples onto a portrait
// phone viewport. Mirrors the foreground card's anchors but tuned for a
// wider canvas (we want the body filling the frame, not just the head).
const BG_OBJECT_POSITION: Record<string, string> = {
  charlie: "center 35%",
  biscuit: "55% 55%",
  mango: "55% 50%",
  pepper: "50% 45%",
  kiwi: "30% 50%",
  toby: "55% 50%",
};

type Props = {
  /** crossfade duration in seconds (default 1.5 — matches the foreground card). */
  fadeSec?: number;
};

export default function HeroFeaturedBackground({ fadeSec = 1.5 }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const { index, pet } = useFeaturedPetRotation();
  const objectPosition = BG_OBJECT_POSITION[pet.slug] ?? "center 40%";

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: -3,
        overflow: "hidden",
        background: "#1A1410",
      }}
    >
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: fadeSec, ease: "linear" }}
          style={{
            position: "absolute",
            inset: 0,
            willChange: "opacity",
          }}
        >
          {/* The image itself — blurred so the foreground card pops. We use
              a slight overscale + negative inset to hide the blurred edge
              halo that CSS `filter: blur()` produces. */}
          <div
            style={{
              position: "absolute",
              inset: -40,
              filter: prefersReducedMotion ? "blur(18px)" : "blur(22px)",
              transform: "scale(1.06)",
              willChange: "filter, transform",
            }}
          >
            <Image
              src={pet.sample}
              alt=""
              fill
              priority={index === 0}
              sizes="100vw"
              style={{
                objectFit: "cover",
                objectPosition,
              }}
            />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
