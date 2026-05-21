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
    eligible_for_curators_pick: true,
  },
  {
    id: 'watercolor',
    label: 'Watercolor',
    paired_container_id: 'watercolor_ribbon',
    directive:
      'Soft watercolor painting style throughout. Bleeding edges, gentle pigment washes, visible paper texture, muted warm palette (cream, rose, soft ochre, dusty teal), soft white highlights left unpainted, every contour dissolved into watery softness. Hand-painted memorial portrait feel.',
    eligible_for_curators_pick: true,
  },
  {
    id: 'storybook_illustration',
    label: 'Storybook Illustration',
    paired_container_id: 'storybook_page',
    directive:
      "Hand-drawn children's storybook illustration style. Soft pencil-and-paint texture, gentle rounded shapes, warm pastel palette, hand-painted backgrounds with visible brushstrokes, a slight printed-page warmth. Tender, timeless, like a beloved picture-book illustration.",
    eligible_for_curators_pick: true,
  },
  {
    id: 'animated_3d',
    label: '3D Animated',
    paired_container_id: 'parchment_scroll',
    directive:
      'Modern 3D animated film style, in the warm tradition of Pixar and Disney feature animation. Soft rounded volumes, expressive eyes with subtle highlights, gentle subsurface scattering on fur, cinematic three-point lighting, warm color grade, slight depth of field. Tender and emotive, the feel of a beloved animated film. Not photoreal, not cartoonish — that loving middle ground modern 3D animation occupies.',
    eligible_for_curators_pick: true,
  },
  {
    id: 'claymation',
    label: 'Claymation',
    paired_container_id: 'plasticine_banner',
    directive:
      'Stop-motion claymation style in the Aardman/Laika tradition. Hand-sculpted plasticine clay figures with visible thumbprints and tooling marks on the clay surface, slightly imperfect handcrafted forms, soft warm tungsten studio lighting on a miniature tabletop diorama, hand-bent wire and paper elements, tactile fabric and clay textures. Handmade, soulful, intimate — the feel of a beloved stop-motion short film.',
    eligible_for_curators_pick: true,
  },
  {
    id: 'pencil_sketch',
    label: 'Pencil Sketch',
    paired_container_id: 'pencil_paper_note',
    directive:
      'Fine graphite pencil sketch portrait on warm cream paper. Visible cross-hatching and feather-light shading, expressive line weight, soft smudged highlights, the slight grain of textured drawing paper, occasional construction lines left visible. Hand-drawn warmth, like a beloved framed memorial sketch in a family home. Monochromatic with warm paper tone, no color flooding, no painting — just pencil.',
    eligible_for_curators_pick: true,
  },
  {
    id: 'pixel_art',
    label: 'Pixel Art',
    paired_container_id: 'pixel_sign',
    directive:
      '16-bit pixel art style in the tradition of beloved retro video games. Limited warm color palette, hand-pixeled sprites with clean readable silhouettes, dithered shading on volumes, soft chunky pixels, gentle scanline texture. Affectionate, nostalgic, joyful — the way a long-loved game character is rendered. Vertical 9:16 framing preserves pixel grid alignment.',
    eligible_for_curators_pick: false,
  },
  {
    id: 'voxel_minecraft',
    label: 'Voxel (Minecraft style)',
    paired_container_id: 'voxel_block_sign',
    directive:
      "Voxel block art style in the visual language of Minecraft. Cubic blocks form every shape — pet, flowers, sky, ground — with simple textured faces, soft AO shading at block edges, friendly chunky proportions, gentle warm lighting on the voxel world. Cheerful and approachable, the way a family memorial built in a child's favorite game would feel.",
    eligible_for_curators_pick: false,
  },
] as const;

const STYLE_BY_ID = new Map<ArtStyleId, ArtStyle>(ART_STYLES.map((s) => [s.id, s]));

export function findArtStyle(id: ArtStyleId | string | null | undefined): ArtStyle | undefined {
  if (!id) return undefined;
  return STYLE_BY_ID.get(id as ArtStyleId);
}
