// Peterna hero carousel — placeholder Unsplash stills.
// These are temporary while the Gemini key lands. Each will be replaced by a
// generated still that matches the candid / natural-environment direction set
// in `docs/gallery-prompts.md`. Final prompts live in
// `docs/hero-carousel-prompts.md` (one per slide).
//
// Cadence (locked by Andre, 2026-05-10):
//   - 6 slides
//   - 6s per slide auto-advance
//   - 1.2s pure crossfade
//   - ken-burns 1.00 → 1.06 across the active 6s (no pan)
//
// Direction: real life, natural light, warm cream/gold palette, shallow DoF.
// Backyards, porches, kitchens, couches with sunbeams, window perches, paths.
// NOT staged interiors. NOT tight portraits.

export type HeroSlide = {
  src: string;
  alt: string;
  /** CSS object-position override for the carousel <Image>. */
  objectPosition?: string;
};

// Picked for survivability under a portrait-mobile center-crop: subject
// roughly centered horizontally, environment readable on either side, no
// tight close-ups of fur or eyes that turn into texture mush when zoomed.
// `objectPosition` per slide tunes the vertical anchor so the subject's eyes
// /face stay above the lower-third overlay text on phones.

export const HERO_SLIDES: HeroSlide[] = [
  // TODO: replace with Gemini-generated image — see docs/hero-carousel-prompts.md (1: Golden Retriever in a backyard)
  {
    src: "https://images.unsplash.com/photo-1552053831-71594a27632d?w=2400&q=70&auto=format&fit=crop",
    alt: "A golden retriever resting in a sunlit backyard, late afternoon light",
    objectPosition: "center 40%",
  },
  // TODO: replace with Gemini-generated image — see docs/hero-carousel-prompts.md (2: parrot on a window perch)
  {
    src: "https://images.unsplash.com/photo-1444464666168-49d633b86797?w=2400&q=70&auto=format&fit=crop",
    alt: "A small parrot perched at a kitchen window in morning light",
    objectPosition: "center 30%",
  },
  // TODO: replace with Gemini-generated image — see docs/hero-carousel-prompts.md (3: cat on a kitchen counter in morning light)
  {
    src: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=2400&q=70&auto=format&fit=crop",
    alt: "An orange tabby cat in soft morning light by a kitchen window",
    objectPosition: "center 35%",
  },
  // TODO: replace with Gemini-generated image — see docs/hero-carousel-prompts.md (4: small dog on a porch at golden hour)
  {
    src: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=2400&q=70&auto=format&fit=crop",
    alt: "A small dog on a wooden porch at golden hour, warm side-light",
    objectPosition: "center 40%",
  },
  // TODO: replace with Gemini-generated image — see docs/hero-carousel-prompts.md (5: dog napping on a couch with a sunbeam)
  {
    src: "https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=2400&q=70&auto=format&fit=crop",
    alt: "A dog napping on a living-room couch in a long sunbeam",
    objectPosition: "center 45%",
  },
  // TODO: replace with Gemini-generated image — see docs/hero-carousel-prompts.md (6: senior dog walking on a path)
  {
    src: "https://images.unsplash.com/photo-1477884213360-7e9d7dcc1e48?w=2400&q=70&auto=format&fit=crop",
    alt: "An older dog walking slowly along a tree-lined path in late afternoon",
    objectPosition: "center 40%",
  },
];
