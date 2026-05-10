// Featured pets shared between the home portrait card (rotating) and the
// gallery grid. Single source of truth so they never drift.
//
// Each pet has:
// - portrait: the 4:5 portrait crop for the home FeaturedPortrait card
// - sample:   the 16:9 candid for the gallery grid + home sample tribute
// - caption:  a short italicized line for the home portrait card (≤ 9 words)
// - excerpt:  the longer multi-sentence excerpt used on the gallery card

export type FeaturedPet = {
  slug: string;
  name: string;
  years: string;
  breed: string;
  portrait: string;
  sample: string;
  caption: string;
  excerpt: string;
};

export const FEATURED_PETS: FeaturedPet[] = [
  {
    slug: "charlie",
    name: "Charlie",
    years: "2007 — 2024",
    breed: "Yellow Lab · 17 years",
    portrait: "/home/portrait-charlie.jpg",
    sample: "/gallery/gallery-01-charlie-yellow-lab.jpg",
    caption: "Some loves never leave the house.",
    excerpt:
      "The good boy. The first dog of a young marriage. The dog the kids grew up with.",
  },
  {
    slug: "biscuit",
    name: "Biscuit",
    years: "2009 — 2023",
    breed: "Golden Retriever · 14 years",
    // Portrait reuses the 16:9 sample for now; cover-cropped to 4:5 by the card
    // (the dog's head sits in the lower-third of the sample, which crops well).
    portrait: "/gallery/gallery-02-biscuit-golden-retriever.jpg",
    sample: "/gallery/gallery-02-biscuit-golden-retriever.jpg",
    caption: "Knew every neighbor by name.",
    excerpt:
      "The golden one. Knew every neighbor by name. Followed the kids to the school bus every morning until he couldn't anymore.",
  },
  {
    slug: "mango",
    name: "Mango",
    years: "2014 — 2023",
    breed: "Tabby cat · 9 years",
    portrait: "/gallery/gallery-03-mango-tabby.jpg",
    sample: "/gallery/gallery-03-mango-tabby.jpg",
    caption: "Owned every windowsill in the house.",
    excerpt:
      "The sunlight tabby. Slept on every laptop. Owned every windowsill in the house.",
  },
  {
    slug: "pepper",
    name: "Pepper",
    years: "1998 — 2011",
    breed: "Border Collie mix · 13 years",
    portrait: "/gallery/gallery-04-pepper-border-collie.jpg",
    sample: "/gallery/gallery-04-pepper-border-collie.jpg",
    caption: "Outsmarted everyone. Loved long.",
    excerpt: "The first family dog. Outsmarted everyone. Loved deeply, loved long.",
  },
  {
    slug: "kiwi",
    name: "Kiwi",
    years: "1998 — 2024",
    breed: "Green-cheeked conure · 26 years",
    portrait: "/gallery/gallery-05-kiwi-conure.jpg",
    sample: "/gallery/gallery-05-kiwi-conure.jpg",
    caption: "Said good morning before the coffee was made.",
    excerpt:
      "The talker. Said good morning before the coffee was made. Whistled the same four notes for twenty-six years.",
  },
  {
    slug: "toby",
    name: "Toby",
    years: "1989 — 2003",
    breed: "Beagle · 14 years",
    portrait: "/gallery/gallery-06-toby-beagle.jpg",
    sample: "/gallery/gallery-06-toby-beagle.jpg",
    caption: "The one who started everything.",
    excerpt:
      "Mom's heart dog. The dog she still talks about. The one who started everything.",
  },
];
