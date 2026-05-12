"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FONT_DISPLAY } from "@/lib/peterna-tokens";
import { useFeaturedPetRotation } from "@/lib/featured-pet-rotation";

type Props = {
  /** crossfade duration in seconds (default 1.5). */
  fadeSec?: number;
};

// Per-pet anchor for cropping the 16:9 samples down to 4:5 on the card.
// (Charlie has a native 4:5 portrait so 'center' is fine.)
const PORTRAIT_OBJECT_POSITION: Record<string, string> = {
  charlie: "center 35%",
  biscuit: "55% 60%",
  mango: "60% 50%",
  pepper: "50% 45%",
  kiwi: "30% 50%",
  toby: "55% 55%",
};

/**
 * Featured portrait card on the home hero. Reads the currently-featured pet
 * from <FeaturedPetRotationProvider> so the hero BACKGROUND (rendered by
 * <HeroFeaturedBackground>) always shows the same pet, blurred + darkened
 * — fixing the 2026-05-11 bug where the hero bg and the foreground card
 * showed two completely different animals.
 *
 * Honours `prefers-reduced-motion` via the shared provider (no auto-advance).
 */
export default function FeaturedPortrait({ fadeSec = 1.5 }: Props) {
  const { pet } = useFeaturedPetRotation();
  const objectPosition = PORTRAIT_OBJECT_POSITION[pet.slug] ?? "center 35%";

  return (
    <div>
      {/* 4:5 portrait card */}
      <div
        className="peterna-hero-portrait"
        style={{
          position: "relative",
          aspectRatio: "4/5",
          borderRadius: 16,
          overflow: "hidden",
          background: "rgba(233,213,195,0.1)",
          border: "1px solid rgba(248,241,228,0.18)",
          maxWidth: 460,
          marginLeft: "auto",
          boxShadow: "0 30px 80px -20px rgba(0,0,0,0.5)",
        }}
      >
        <AnimatePresence mode="sync" initial={false}>
          <motion.img
            key={pet.slug}
            src={pet.portrait}
            alt={`${pet.name}, ${pet.breed.toLowerCase()}, in warm afternoon light`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: fadeSec, ease: "linear" }}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition,
              willChange: "opacity",
            }}
          />
        </AnimatePresence>
        {/* Soft bottom gradient for caption legibility if it ever sits inside
            the card (kept for design consistency with the previous static
            version). */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "linear-gradient(to bottom, transparent 60%, rgba(42,33,27,0.25) 100%)",
          }}
          aria-hidden="true"
        />

        {/* Politely announce pet changes to screen readers */}
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
          {`Featured tribute: ${pet.name}, ${pet.years}. ${pet.caption}`}
        </div>
      </div>

      {/* Caption — crossfades with the image as one unit. min-height keeps the
          card from jumping when shorter and longer captions cycle. */}
      <div style={{ minHeight: 44, marginTop: 12 }}>
        <AnimatePresence mode="sync" initial={false}>
          <motion.p
            key={pet.slug}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: fadeSec, ease: "linear" }}
            style={{
              textAlign: "center",
              fontSize: 14,
              fontStyle: "italic",
              color: "rgba(248,241,228,0.7)",
              fontFamily: FONT_DISPLAY,
              margin: 0,
              willChange: "opacity",
            }}
          >
            &ldquo;{pet.caption}&rdquo;{" "}
            <span
              style={{
                fontStyle: "normal",
                fontFamily: FONT_DISPLAY,
                color: "rgba(248,241,228,0.45)",
                fontSize: 12,
                marginLeft: 6,
              }}
            >
              — {pet.name}, {pet.years}
            </span>
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
