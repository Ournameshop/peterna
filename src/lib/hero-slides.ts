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
};

export const HERO_SLIDES: HeroSlide[] = [
  // TODO: replace with Gemini-generated image — see docs/hero-carousel-prompts.md (1: Golden Retriever in a backyard)
  {
    src: "https://images.unsplash.com/photo-1633722715534-de2f3f6b6e26?w=2400&q=70&auto=format&fit=crop",
    alt: "A golden retriever resting in a sunlit backyard, late afternoon light",
  },
  // TODO: replace with Gemini-generated image — see docs/hero-carousel-prompts.md (2: parrot on a window perch)
  {
    src: "https://images.unsplash.com/photo-1591608971362-f08b2a75731a?w=2400&q=70&auto=format&fit=crop",
    alt: "A small green parrot perched at a kitchen window in morning light",
  },
  // TODO: replace with Gemini-generated image — see docs/hero-carousel-prompts.md (3: cat on a kitchen counter in morning light)
  {
    src: "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=2400&q=70&auto=format&fit=crop",
    alt: "An orange tabby cat on a kitchen counter, soft morning light through the window",
  },
  // TODO: replace with Gemini-generated image — see docs/hero-carousel-prompts.md (4: small dog on a porch at golden hour)
  {
    src: "https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?w=2400&q=70&auto=format&fit=crop",
    alt: "A small dog on a wooden porch at golden hour, warm side-light",
  },
  // TODO: replace with Gemini-generated image — see docs/hero-carousel-prompts.md (5: dog napping on a couch with a sunbeam)
  {
    src: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=2400&q=70&auto=format&fit=crop",
    alt: "A dog napping on a living-room couch in a long sunbeam",
  },
  // TODO: replace with Gemini-generated image — see docs/hero-carousel-prompts.md (6: senior dog walking on a path)
  {
    src: "https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?w=2400&q=70&auto=format&fit=crop",
    alt: "An older dog walking slowly along a tree-lined path in late afternoon",
  },
];
