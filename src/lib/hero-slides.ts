// Peterna hero carousel — Gemini (nano-banana-pro-preview) generated stills.
// Generated 2026-05-10 from prompts in `docs/hero-carousel-prompts.md`.
// Source files live in `/public/hero/slides/` and are served through the
// Next.js image optimizer (re-encoded to AVIF/WebP per request).
//
// Cadence (locked by Andre, 2026-05-10):
//   - 6 slides
//   - 6s per slide auto-advance
//   - 1.2s pure crossfade
//   - ken-burns 1.00 → 1.06 across the active 6s (no pan)
//
// `objectPosition` per slide tunes the vertical anchor so the subject's
// face/body stays visible when a 16:9 still is cover-cropped onto a
// portrait phone viewport.

export type HeroSlide = {
  src: string;
  alt: string;
  /** CSS object-position override for the carousel <Image>. */
  objectPosition?: string;
};

// objectPosition values were measured per-image (subject head as anchor)
// against the actual generated 16:9 stills, so when cover-cropped to a
// 9:16 portrait phone viewport the pet stays in frame.
export const HERO_SLIDES: HeroSlide[] = [
  {
    src: "/hero/slides/01-backyard-golden.jpg",
    alt: "A golden retriever resting in a sunlit backyard, late afternoon light",
    objectPosition: "52% 38%",
  },
  {
    src: "/hero/slides/02-window-parrot.jpg",
    alt: "A small green-cheeked conure parrot at a kitchen window in morning light",
    objectPosition: "22% 45%",
  },
  {
    src: "/hero/slides/03-kitchen-tabby.jpg",
    alt: "An orange tabby cat on a sunlit kitchen counter, mid-morning",
    objectPosition: "62% 48%",
  },
  {
    src: "/hero/slides/04-porch-small-dog.jpg",
    alt: "A small mixed-breed dog on a wooden front porch at golden hour",
    objectPosition: "58% 35%",
  },
  {
    src: "/hero/slides/05-couch-sunbeam-dog.jpg",
    alt: "A medium dog sleeping on a linen couch in a long afternoon sunbeam",
    objectPosition: "55% 52%",
  },
  {
    src: "/hero/slides/06-path-senior-dog.jpg",
    alt: "A senior gray-muzzled dog walking slowly down a garden path at golden hour",
    objectPosition: "48% 48%",
  },
];
