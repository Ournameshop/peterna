// Art-style library — Phase 2 + Phase 3.
//
// Per `phase-plan.md`: Phase 2 only needs `id`, `label`, `paired_container_id`,
// and `directive` (used to inject the per-style visual register into prompts).
// Phase 3 reuses this file for the manual-path style picker — that's why this
// module is NOT marked `'server-only'`. The directive strings are prompt
// content, not credentials; shipping them to the client is fine. Phase 4+
// extends each entry with the full container spec for baked typography.
//
// The directive strings come verbatim from the spec's `art_styles:` YAML
// (`/Users/xeeshan/Downloads/SKILL (5).md` lines 1744–1798). The
// paired_container_id mapping matches the spec's "Typography pairing matrix"
// (HARD rule, spec line 208).

export type ArtStyleId =
  | 'cinematic_realism'
  | 'watercolor'
  | 'storybook_illustration'
  | 'animated_3d'
  | 'claymation'
  | 'pencil_sketch'
  | 'pixel_art'
  | 'voxel_minecraft';

export type PairedContainerId =
  | 'cinematic_lower_third'
  | 'watercolor_ribbon'
  | 'storybook_page'
  | 'parchment_scroll'
  | 'plasticine_banner'
  | 'pencil_paper_note'
  | 'pixel_sign'
  | 'voxel_block_sign';

export type ArtStyle = {
  id: ArtStyleId;
  label: string;
  /** Container the typography pipeline pairs with this style (spec §"Typography pairing matrix"). */
  paired_container_id: PairedContainerId;
  /** Visual-register directive injected into prompts that render in this style. */
  directive: string;
  /**
   * Phase 5: typography-pairing container spec, verbatim from spec §"Typography
   * pairing matrix (HARD)" (line 209-221). Embedded by the Stage 5.6 card-
   * preview prompt builder whenever a caption or title is rendered.
   *
   * Each value follows the spec's hard rule: a named decorative object, a
   * paper/material texture with hex base color, a separate hex text color,
   * "~80% frame width centered in the lower portion of the frame," "casts a
   * soft drop shadow onto the scene below," and the explicit phrase "not a
   * UI bar — an illustrated decorative object." The Cinematic Realism row is
   * the documented exception: a UI-bar treatment is acceptable there because
   * it matches actual film convention.
   */
  typography_directive: string;
  /** Spec's "eligible_for_curators_pick" flag — Pixel Art and Voxel are opt-in only. */
  eligible_for_curators_pick: boolean;
};

export const ART_STYLES: readonly ArtStyle[] = [
  {
    id: 'cinematic_realism',
    label: 'Cinematic Realism',
    paired_container_id: 'cinematic_lower_third',
    directive:
      'Cinematic painterly photorealism. Soft warm color grade, gentle natural lighting, slight cinematic depth of field, photoreal textures and fur detail. Reverent, intimate, real.',
    typography_directive:
      'Typography container: a soft dark cinematic lower-third gradient bar — base color #0F1418 with a soft gradient falloff at the top edge, warm cream #F5EFE3 italic serif text inside (festival-card style). Spans ~80% of frame width, centered in the lower portion of the frame. Casts a soft drop shadow onto the scene below. This is the documented exception to the "not a UI bar" rule — the lower-third bar is acceptable here because it matches actual film convention. Identical specification on every scene in the storyboard.',
    eligible_for_curators_pick: true,
  },
  {
    id: 'watercolor',
    label: 'Watercolor',
    paired_container_id: 'watercolor_ribbon',
    directive:
      'Soft watercolor painting style throughout. Bleeding edges, gentle pigment washes, visible paper texture, muted warm palette (cream, rose, soft ochre, dusty teal), soft white highlights left unpainted, every contour dissolved into watery softness. Hand-painted memorial portrait feel.',
    typography_directive:
      'Typography container: a hand-painted watercolor ribbon with bleeding watercolor edges and soft tape-corner attachments at the top, painted on cream paper base color #F2E8D5, with sepia brush calligraphy text in #5A3520. Spans ~80% of frame width, centered in the lower portion of the frame. Casts a soft watercolor drop shadow onto the scene below. Not a UI bar — an illustrated decorative object, painted into the same watercolor world as the scene. Identical specification on every scene in the storybook.',
    eligible_for_curators_pick: true,
  },
  {
    id: 'storybook_illustration',
    label: 'Storybook Illustration',
    paired_container_id: 'storybook_page',
    directive:
      "Hand-drawn children's storybook illustration style. Soft pencil-and-paint texture, gentle rounded shapes, warm pastel palette, hand-painted backgrounds with visible brushstrokes, a slight printed-page warmth. Tender, timeless, like a beloved picture-book illustration.",
    typography_directive:
      "Typography container: an open page from a children's picture book — cream paper base color #F4EAD0 with subtle wildflower ornament in one corner, a dog-eared paper edge, soft visible paper texture, and warm brown #5A3E1F serif text on its surface. Spans ~80% of frame width, centered in the lower portion of the frame. Casts a soft drop shadow onto the scene below. Not a UI bar — an illustrated decorative object, the page sitting within the storybook world. Identical specification on every scene in the storybook.",
    eligible_for_curators_pick: true,
  },
  {
    id: 'animated_3d',
    label: '3D Animated',
    paired_container_id: 'parchment_scroll',
    directive:
      'Modern 3D animated film style, in the warm tradition of Pixar and Disney feature animation. Soft rounded volumes, expressive eyes with subtle highlights, gentle subsurface scattering on fur, cinematic three-point lighting, warm color grade, slight depth of field. Tender and emotive, the feel of a beloved animated film. Not photoreal, not cartoonish — that loving middle ground modern 3D animation occupies.',
    typography_directive:
      'Typography container: a horizontal parchment scroll with rolled curled ends on both sides, a thin warm brown outlined border, warm tan #E8D9B5 paper texture inside, with centered dark brown #5A3E1F Pixar-storybook serif text. Spans ~80% of frame width, centered in the lower portion of the frame. Casts a soft drop shadow onto the scene below. Not a UI bar — an illustrated decorative object, the scroll resting in the same 3D-animated world. Identical specification on every scene in the storybook.',
    eligible_for_curators_pick: true,
  },
  {
    id: 'claymation',
    label: 'Claymation',
    paired_container_id: 'plasticine_banner',
    directive:
      'Stop-motion claymation style in the Aardman/Laika tradition. Hand-sculpted plasticine clay figures with visible thumbprints and tooling marks on the clay surface, slightly imperfect handcrafted forms, soft warm tungsten studio lighting on a miniature tabletop diorama, hand-bent wire and paper elements, tactile fabric and clay textures. Handmade, soulful, intimate — the feel of a beloved stop-motion short film.',
    typography_directive:
      'Typography container: a sculpted plasticine banner physically sitting in the diorama — made of warm cream-tan plasticine base color #E6D2A8 with visible thumbprints, a thin dark plasticine outline #2C1F14, dimensional rolled edges, holding hand-shaped clay letters in dark plasticine #3A2A1B. Spans ~80% of frame width, centered in the lower portion of the frame. Casts a soft drop shadow onto the scene below. Not a UI bar — an illustrated decorative object, a real sculpted plasticine prop in the same tabletop diorama. Identical specification on every scene in the storybook.',
    eligible_for_curators_pick: true,
  },
  {
    id: 'pencil_sketch',
    label: 'Pencil Sketch',
    paired_container_id: 'pencil_paper_note',
    directive:
      'Fine graphite pencil sketch portrait on warm cream paper. Visible cross-hatching and feather-light shading, expressive line weight, soft smudged highlights, the slight grain of textured drawing paper, occasional construction lines left visible. Hand-drawn warmth, like a beloved framed memorial sketch in a family home. Monochromatic with warm paper tone, no color flooding, no painting — just pencil.',
    typography_directive:
      'Typography container: a small loose sheet of warm cream paper base color #F0E4CC drawn in pencil, attached to the scene with a hand-drawn paperclip or a piece of soft washi tape, holding graphite cursive text in #2E2620. Spans ~80% of frame width, centered in the lower portion of the frame. Casts a soft pencil-shaded drop shadow onto the scene below. Not a UI bar — an illustrated decorative object, a real paper note pinned into the sketched world. Identical specification on every scene in the storybook.',
    eligible_for_curators_pick: true,
  },
  {
    id: 'pixel_art',
    label: 'Pixel Art',
    paired_container_id: 'pixel_sign',
    directive:
      '16-bit pixel art style in the tradition of beloved retro video games. Limited warm color palette, hand-pixeled sprites with clean readable silhouettes, dithered shading on volumes, soft chunky pixels, gentle scanline texture. Affectionate, nostalgic, joyful — the way a long-loved game character is rendered. Vertical 9:16 framing preserves pixel grid alignment.',
    typography_directive:
      'Typography container: a pixel-art wooden sign or carved stone tablet built entirely from pixels — sign base color warm wood #A07242 with a chunky pixel border in #5A3A20, hanging from pixel-art chains or planted into the ground, holding 8-bit bitmap caps text in cream #F5E5C5. Spans ~80% of frame width, centered in the lower portion of the frame. Casts a chunky pixel drop shadow onto the scene below. Not a UI bar — an illustrated decorative object, a real pixel-art sign placed in the pixel world. Identical specification on every scene in the storybook.',
    eligible_for_curators_pick: false,
  },
  {
    id: 'voxel_minecraft',
    label: 'Voxel (Minecraft style)',
    paired_container_id: 'voxel_block_sign',
    directive:
      "Voxel block art style in the visual language of Minecraft. Cubic blocks form every shape — pet, flowers, sky, ground — with simple textured faces, soft AO shading at block edges, friendly chunky proportions, gentle warm lighting on the voxel world. Cheerful and approachable, the way a family memorial built in a child's favorite game would feel.",
    typography_directive:
      'Typography container: a three-dimensional voxel sign block or Minecraft-style hanging banner built entirely from cubes — wood-block base color #8B5A2B with planked face texture, with ambient occlusion shadows underneath, holding three-dimensional voxel block letters in cream #EEDDB5. Spans ~80% of frame width, centered in the lower portion of the frame. Casts a soft voxel drop shadow onto the scene below. Not a UI bar — an illustrated decorative object, a real voxel sign built into the voxel world. Identical specification on every scene in the storybook.',
    eligible_for_curators_pick: false,
  },
] as const;

const STYLE_BY_ID = new Map<ArtStyleId, ArtStyle>(ART_STYLES.map((s) => [s.id, s]));

export function findArtStyle(id: ArtStyleId | string | null | undefined): ArtStyle | undefined {
  if (!id) return undefined;
  return STYLE_BY_ID.get(id as ArtStyleId);
}
