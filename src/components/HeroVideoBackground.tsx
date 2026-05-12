"use client";

// HeroVideoBackground — full-bleed looping background video for the hero
// section. Replaces <HeroFeaturedBackground> (which mirrored the currently-
// featured pet, blurred + darkened) at Andre's request on 2026-05-12:
// "replace hero image on staging with attached background video".
//
// Sits at z-index: -3 so the existing dark warm + radial gold overlays in
// page.tsx (z-index: -1) stack correctly on top — same stacking contract
// the previous background component honored.
//
// Loading strategy:
//   - poster image (peterna-hero-poster.jpg) renders instantly while video
//     buffers, so first paint is never blank.
//   - <source> tags prefer .webm where supported, fall back to .mp4.
//   - autoPlay + muted + playsInline + loop is the iOS-Safari-friendly combo
//     required to keep inline autoplay working on mobile.
//   - preload="metadata" keeps initial payload small; the browser starts
//     pulling frames after first paint.

import { useReducedMotion } from "framer-motion";

type Props = {
  /** Public path to the mp4 source. Default: /hero/peterna-hero.mp4 */
  mp4Src?: string;
  /** Public path to the webm source. Default: /hero/peterna-hero.webm */
  webmSrc?: string;
  /** Public path to the poster image. Default: /hero/peterna-hero-poster.jpg */
  posterSrc?: string;
};

export default function HeroVideoBackground({
  mp4Src = "/hero/peterna-hero.mp4",
  webmSrc = "/hero/peterna-hero.webm",
  posterSrc = "/hero/peterna-hero-poster.jpg",
}: Props) {
  const prefersReducedMotion = useReducedMotion();

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
      {prefersReducedMotion ? (
        // Honor reduced-motion: show the still poster instead of looping video.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={posterSrc}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
      ) : (
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={posterSrc}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        >
          <source src={webmSrc} type="video/webm" />
          <source src={mp4Src} type="video/mp4" />
        </video>
      )}
    </div>
  );
}
