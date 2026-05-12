"use client";

// FeaturedPortraitGallery — editorial gallery of all featured pets with
// one large rotating "featured" card and a column of thumbnails. Built
// 2026-05-12 in response to Andre's review of the previous standalone
// <FeaturedPortrait> section:
//   "Honestly? No, it's not A+. […] A single 460px portrait floating in a
//    sea of C.ink brown reads as lonely, not intentional. […] Captions
//    are colliding/overlapping at the bottom […] When it was the hero
//    portrait, the rotation made sense. Standalone, you'd expect to see
//    *several* pets at once — a gallery, not a single rotating card."
//
// Design:
//   - Left column (lg+): large rotating featured card (4:5, ~480px wide),
//     name + years + breed below it (fixed-height block so it doesn't jump
//     between pets), then a 2-line excerpt and a "See more tributes →"
//     link to /gallery.
//   - Right column (lg+): vertical strip of all 6 pet thumbnails (1:1 each,
//     compact). The currently-featured pet has a gold ring + full opacity;
//     others are muted to 0.55. Clicking a thumbnail jumps the rotation to
//     that pet via the shared <FeaturedPetRotationProvider>.
//   - Mobile (<lg): stacks. Featured card on top, thumbnails become a
//     horizontal scroll strip below it.
//   - Crossfade for the featured image/caption mirrors the previous card
//     (1.5s, AnimatePresence mode="sync") so the rotation rhythm matches
//     the hero video bg and any future synced elements.
//
// Reads from <FeaturedPetRotationProvider> via useFeaturedPetRotation()
// so the auto-advance + reduced-motion handling already live there.

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";
import { useFeaturedPetRotation } from "@/lib/featured-pet-rotation";
import { FEATURED_PETS } from "@/lib/pets";

// Per-pet anchor for cropping the wider samples to the 4:5 featured card.
// (Mirrors the anchors previously used by <FeaturedPortrait>.)
const PORTRAIT_OBJECT_POSITION: Record<string, string> = {
  charlie: "center 35%",
  biscuit: "55% 60%",
  mango: "60% 50%",
  pepper: "50% 45%",
  kiwi: "30% 50%",
  toby: "55% 55%",
};

// 1:1 thumbnail anchors — tend to want a tighter face crop than the 4:5
// card, since the thumbnails are small and we want the animal's eyes
// visible at thumb size.
const THUMB_OBJECT_POSITION: Record<string, string> = {
  charlie: "center 30%",
  biscuit: "55% 50%",
  mango: "60% 45%",
  pepper: "50% 40%",
  kiwi: "30% 45%",
  toby: "55% 45%",
};

const FADE_SEC = 1.2;

export default function FeaturedPortraitGallery() {
  const { pet, index, goTo } = useFeaturedPetRotation();
  const objectPosition = PORTRAIT_OBJECT_POSITION[pet.slug] ?? "center 35%";

  return (
    <div className="peterna-portrait-gallery">
      {/* Featured card column */}
      <div className="peterna-portrait-featured">
        <div
          style={{
            position: "relative",
            aspectRatio: "4/5",
            borderRadius: 18,
            overflow: "hidden",
            background: "rgba(233,213,195,0.08)",
            border: "1px solid rgba(248,241,228,0.14)",
            boxShadow: "0 30px 80px -20px rgba(0,0,0,0.55)",
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
              transition={{ duration: FADE_SEC, ease: "linear" }}
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
          {/* Soft bottom gradient for any inset caption legibility */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background:
                "linear-gradient(to bottom, transparent 55%, rgba(20,15,10,0.55) 100%)",
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

        {/* Name / years / breed — fixed-height block so it never jumps when
            captions of different lengths cycle in. The biggest pet has
            "Green-cheeked conure · 26 years" so we reserve 3 lines worth. */}
        <div style={{ minHeight: 132, marginTop: 24 }}>
          <AnimatePresence mode="sync" initial={false}>
            <motion.div
              key={pet.slug}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: FADE_SEC, ease: "linear" }}
              style={{ willChange: "opacity, transform" }}
            >
              <div
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 400,
                  fontSize: "clamp(28px, 3.2vw, 40px)",
                  lineHeight: 1.05,
                  letterSpacing: "-0.01em",
                  color: C.cream,
                }}
              >
                {pet.name}
                <span
                  style={{
                    marginLeft: 14,
                    color: "rgba(248,241,228,0.45)",
                    fontFamily: FONT_DISPLAY,
                    fontStyle: "italic",
                    fontSize: "clamp(16px, 1.8vw, 22px)",
                  }}
                >
                  {pet.years}
                </span>
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "rgba(248,241,228,0.5)",
                  fontFamily: FONT_SANS,
                }}
              >
                {pet.breed}
              </div>
              <p
                style={{
                  marginTop: 14,
                  fontFamily: FONT_DISPLAY,
                  fontStyle: "italic",
                  fontSize: "clamp(16px, 1.6vw, 19px)",
                  lineHeight: 1.5,
                  color: "rgba(248,241,228,0.78)",
                  maxWidth: 480,
                }}
              >
                &ldquo;{pet.excerpt}&rdquo;
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div style={{ marginTop: 28 }}>
          <Link
            href="/gallery"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: FONT_SANS,
              fontSize: 14,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: C.gold,
              textDecoration: "none",
              borderBottom: `1px solid rgba(201,169,97,0.4)`,
              paddingBottom: 4,
            }}
          >
            See more tributes <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Thumbnail strip */}
      <div className="peterna-portrait-thumbs">
        {FEATURED_PETS.map((p, i) => {
          const isActive = i === index;
          const thumbPos = THUMB_OBJECT_POSITION[p.slug] ?? "center 40%";
          return (
            <button
              key={p.slug}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show tribute for ${p.name}`}
              aria-current={isActive ? "true" : undefined}
              className="peterna-portrait-thumb"
              style={{
                position: "relative",
                aspectRatio: "1/1",
                width: "100%",
                borderRadius: 12,
                overflow: "hidden",
                cursor: "pointer",
                padding: 0,
                background: "rgba(233,213,195,0.06)",
                border: isActive
                  ? `2px solid ${C.gold}`
                  : "1px solid rgba(248,241,228,0.12)",
                opacity: isActive ? 1 : 0.55,
                transition:
                  "opacity 0.4s ease, border-color 0.4s ease, transform 0.3s ease",
                outline: "none",
                boxShadow: isActive
                  ? "0 12px 32px -10px rgba(201,169,97,0.4)"
                  : "none",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.portrait}
                alt=""
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: thumbPos,
                }}
              />
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  padding: "10px 12px",
                  background:
                    "linear-gradient(to top, rgba(20,15,10,0.78), transparent)",
                  color: C.cream,
                  fontFamily: FONT_DISPLAY,
                  fontSize: 14,
                  letterSpacing: "0.01em",
                }}
              >
                {p.name}
              </span>
            </button>
          );
        })}
      </div>

      <style>{`
        .peterna-portrait-gallery {
          display: grid;
          grid-template-columns: 1fr;
          gap: 40px;
          align-items: start;
        }
        .peterna-portrait-thumbs {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        .peterna-portrait-thumb:hover { opacity: 1 !important; transform: translateY(-2px); }
        .peterna-portrait-thumb:focus-visible {
          outline: 2px solid ${C.gold};
          outline-offset: 3px;
        }
        @media (min-width: 768px) {
          .peterna-portrait-thumbs { grid-template-columns: repeat(6, 1fr); }
        }
        @media (min-width: 1024px) {
          .peterna-portrait-gallery {
            grid-template-columns: minmax(0, 1fr) 280px;
            gap: 56px;
          }
          .peterna-portrait-thumbs {
            grid-template-columns: 1fr;
            gap: 14px;
          }
        }
      `}</style>
    </div>
  );
}
