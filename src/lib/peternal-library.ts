// ============================================================================
// peternal-library.ts — Single source of truth for all Peternal typed data.
// Pure data, no React import. Every const is `as const`.
// ============================================================================

// ---- ID union types ---------------------------------------------------------

export type FormatId =
  | 'music_video'
  | 'biopic'
  | 'day_in_the_life'
  | 'letter'
  | 'greatest_hits'
  | 'send_off'
  | 'postcards'
  | 'forever_young';

export type ThemeCategoryId =
  | 'healing_and_peace'
  | 'quiet_grief'
  | 'home_and_everyday_love'
  | 'nature_and_freedom'
  | 'their_personality'
  | 'spiritual_and_symbolic';

export type ThemeId =
  | 'rainbow_bridge'
  | 'sunrise_reunion'
  | 'eternal_garden'
  | 'gentle_rain'
  | 'moonlight_vigil'
  | 'quiet_home'
  | 'beloved_places'
  | 'golden_meadow'
  | 'endless_shore'
  | 'forever_playful'
  | 'nap_champion'
  | 'starlit_reunion'
  | 'signs_and_symbols';

export type ArtStyleId =
  | 'cinematic_realism'
  | 'watercolor'
  | 'storybook_illustration'
  | 'animated_3d'
  | 'claymation'
  | 'pencil_sketch'
  | 'pixel_art'
  | 'voxel_minecraft';

export type ContainerId =
  // 8 style-paired
  | 'cinematic_lower_third'
  | 'watercolor_ribbon'
  | 'storybook_page'
  | 'parchment_scroll'
  | 'plasticine_banner'
  | 'paperclip_note'
  | 'pixel_sign'
  | 'voxel_sign'
  // 5 memorial
  | 'engraved_stone_plaque'
  | 'polaroid_border'
  | 'postcard_back'
  | 'embroidered_sampler'
  | 'pressed_flower_bookmark';

export type CuratorPickId =
  | 'classic_send_off'
  | 'joyful_celebration'
  | 'quiet_goodbye'
  | 'storybook_for_them'
  | 'quiet_remembrance'
  | 'forever_in_stone';

export type RelationshipId =
  | 'childhood'
  | 'partnership'
  | 'companion_through_grief'
  | 'family_first'
  | 'rescue_last_chapter'
  | 'always_mine'
  | 'unspecified';

export type Gender = 'male' | 'female' | 'neutral';

export type AspectId = '9:16' | '16:9' | '1:1' | 'all_three';

export type DpStyleId =
  | 'none'
  | 'deakins_minimalist'
  | 'lubezki_natural'
  | 'young_intimate'
  | 'khondji_painterly'
  | 'wong_kar_wai_dreamy';

export type BeatArchetype = 'open' | 'memory' | 'connection' | 'ceremonial' | 'release' | 'close';

// ---- Cinematography engine field union types --------------------------------
// Exported so state.ts and peternal-cinematography.ts can import them.

export type CameraMove =
  | 'locked_off'
  | 'slow_push'
  | 'slow_pull'
  | 'slow_rise'
  | 'slow_fall'
  | 'slow_pan_L'
  | 'slow_pan_R'
  | 'slow_orbit'
  | 'parallax_dolly'
  | 'handheld_float'
  | 'dreamy_drift';

export type LightingMotion =
  | 'static'
  | 'drifting_sunbeam'
  | 'leaf_dapple_breeze'
  | 'candle_flicker'
  | 'dust_motes'
  | 'rim_light_pulse';

export type DofBehavior =
  | 'locked_shallow'
  | 'locked_deep'
  | 'rack_to_subject'
  | 'rack_to_environment'
  | 'rack_to_caption';

export type AmbientAudio =
  | 'birdsong'
  | 'wind_grass'
  | 'hearth_crackle'
  | 'soft_rain'
  | 'water_lapping'
  | 'silence'
  | 'breath_only';

export type SubjectPose =
  | 'lying'
  | 'sitting'
  | 'standing'
  | 'walking'
  | 'running'
  | 'mid_leap'
  | 'closed_eyes';

export type SubjectEnergy = 'still' | 'low' | 'medium' | 'high';

export type Framing =
  | 'extreme_close'
  | 'close'
  | 'medium'
  | 'wide'
  | 'extreme_wide';

export type EnvironmentalMotion =
  | 'still'
  | 'wind'
  | 'water'
  | 'particles'
  | 'sky'
  | 'dappled_light';

// ---- Data model interfaces --------------------------------------------------

export interface Format {
  id: FormatId;
  name: string;
  desc: string;
  bestFor: number[];
  imagePrompt: string;
}

export interface ThemeCategory {
  id: ThemeCategoryId;
  name: string;
  emoji: string;
  desc: string;
  themeIds: ThemeId[];
}

export interface Theme {
  id: ThemeId;
  name: string;
  category: ThemeCategoryId;
  desc: string;
  gradient: string;
  imagePrompt: string;
}

export interface ArtStyle {
  id: ArtStyleId;
  name: string;
  emoji: string;
  desc: string;
  directive: string;
  eligibleForCuratorsPick: boolean;
  imagePrompt: string;
}

export interface CaptionContainer {
  id: ContainerId;
  name: string;
  group: 'style_paired' | 'memorial';
  pairedStyle?: ArtStyleId;
  leafIcon: boolean;
  spec: string;
}

export interface CuratorPick {
  id: CuratorPickId;
  name: string;
  format: FormatId;
  theme: ThemeId;
  style: ArtStyleId;
  tagline: string;
  container: ContainerId;
  imagePrompt?: string;
}

export interface Relationship {
  id: RelationshipId;
  label: string;
  defaultThemeBias: ThemeId[];
  defaultStyleBias: ArtStyleId[];
  narrationTone: string;
  curatorsPickPriority: CuratorPickId;
}

export interface MemoryPrompt {
  id: string;
  label: string;
  placeholder: string;
}

export interface PersonalityTrait {
  id: string;
  label: string;
  phrase: string;
  adjectiveTag: string;
}

export interface FavoriteThing {
  id: string;
  label: string;
  sceneHint: string;
}

export interface Archetype {
  id: string;
  name: string;
  group: string;
  template: string;
  description?: string;
  isDefault?: boolean;
}

export interface MusicTrack {
  id: string;
  name: string;
  description: string;
  durationS: number;
  mood: string;
  pairsWith: ThemeCategoryId[];
  styleMatch: ArtStyleId[];
  // MP3 assets must be dropped into public/music/ and wired here to activate the music bed.
  fileUrl?: string;
}

export interface NarrationVoice {
  id: string;
  name: string;
  description: string;
  defaultFor: ArtStyleId[];
}

export interface LengthOption {
  id: 2 | 3 | 4;
  name: string;
  subtitle: string;
  beatCount: 8 | 12 | 16;
  targetMinutes: 2 | 3 | 4;
}

export interface AspectOption {
  id: AspectId;
  name: string;
  subtitle: string;
  ratio: string;
}

export interface PronounSet {
  pronounSubject: string;
  pronounObject: string;
  pronounPossessive: string;
  pronounReflexive: string;
  vocativePlain: string;
  vocative: string;
  vocativeBuddy: string;
  vocativeGood: string;
  vocativeDear: string;
}

export interface DpStyleBias {
  lensPrefer?: number[];
  movePrefer?: CameraMove[];
  lightingPrefer?: LightingMotion[];
  dofPrefer?: DofBehavior;
  shotPrefer?: string;
  notes: string;
}

export interface DpStyle {
  id: DpStyleId;
  name: string;
  bias: string;
}

export interface ConsistencyConstraint {
  id: string;
  rule: string;
  defaultRangesByFormat?: Partial<Record<FormatId, number[]>>;
  maxConsecutive?: number;
  captionWordThreshold?: number;
  maxSoundFamilies?: number;
}

export interface DerivationField {
  field: string;
  values: (string | number)[];
  sourcedFrom: string;
  default?: string;
  notes?: string;
}

export interface CinematographyEngineSchema {
  visionInputs: {
    subjectEnergy: SubjectEnergy[];
    subjectPose: SubjectPose[];
    framing: Framing[];
    environmentalMotion: EnvironmentalMotion[];
    depthLayers: string[];
    dominantPaletteTemperature: string[];
  };
  derivationFields: DerivationField[];
  consistencyConstraints: ConsistencyConstraint[];
}

// ============================================================================
// FORMATS — verbatim from FORMATS in page.tsx
// ============================================================================

export const formats: readonly Format[] = [
  {
    id: 'music_video',
    name: 'Music Video',
    desc: 'Beats cut to musical structure – dynamic, celebratory.',
    bestFor: [2, 3],
    imagePrompt:
      'A cinematic photoreal film-strip aesthetic representing a music-video format pet tribute, 3:2 landscape. Five rectangular film frames in a horizontal sequence, each holding a different rhythmic moment of a sun-drenched dog at play: opening wide shot of a meadow with the dog small in frame, second frame a mid-energy run, third frame a high-energy mid-leap with motion blur, fourth frame a slow-motion suspension at peak joy, fifth frame a soft outro of the dog at rest catching breath in golden light. Frames have subtle 35mm sprocket holes top and bottom, soft film grain, warm cinematic color grade across all five panels – amber, gold, peach. The frames are connected as one continuous filmstrip on a soft cream paper background. Mood is musical, rhythmic, alive. NO text, NO words inside the frames or anywhere. Universal warm-toned dog silhouette, not breed-specific. Composition: filmstrip horizontal, slightly tilted ~3 degrees for energy. Color palette: warm amber, peach, cream paper backing, gold highlights, soft black sprocket holes. Avoid: identifiable breeds, modern objects, digital effects, harsh contrast, melancholy. Feel: the format\'s rhythm and joy made visible – five musical beats of love.',
  },
  {
    id: 'biopic',
    name: 'Biopic',
    desc: 'A chronological life story, puppy to golden years.',
    bestFor: [3, 4],
    imagePrompt:
      'A cinematic photoreal storytelling image representing a chronological pet biopic, 3:2 landscape. A horizontal sequence of four soft vignettes blending into one another like film dissolves: leftmost shows a tiny puppy silhouette in spring grass with dandelions, second shows a young adult dog mid-run with longer legs in summer fields, third shows an adult dog at prime resting alert in golden afternoon light, fourth shows a senior gray-muzzled dog lying peacefully in late-autumn warmth with leaves drifting down. The four scenes blend with soft gradient transitions – spring green → summer gold → autumn amber → winter cream. Each scene shares cinematic photoreal depth of field and warm 35mm grade. NO text, NO words, NO timestamps or year labels. Universal warm-toned dog silhouette, same gentle figure aged across four life stages. Mood is reverent, the passage of years made visible. Composition: horizontal four-act flow, eye reads left to right, each scene roughly equal size with subtle vignette darkening at edges. Color palette: spring sage, summer gold, autumn amber, soft winter cream, with consistent cream paper background tying them together. Avoid: identifiable breeds, harsh divisions between scenes, modern objects, anything clinical, hard outlines, digital-feeling. Feel: a whole life, gently traced.',
  },
  {
    id: 'day_in_the_life',
    name: 'Day in the Life',
    desc: 'One perfect imagined day, gentle and present.',
    bestFor: [2, 3, 4],
    imagePrompt:
      'A cinematic photoreal lifestyle image representing one perfect day in a beloved dog\'s life, 3:2 landscape. A horizontal sun-arc composition showing the same warm-toned dog at five points in a single day: morning stretch in a sunny doorway (lower-left), midday play in a backyard with a tennis ball (left-center), afternoon nap on a sunlit porch (center), evening walk in golden hour (right-center), nighttime curl-up on a bed with moonlight through window (lower-right). Above the scenes arcs a soft gradient sky – pink dawn → blue midday → golden afternoon → orange dusk → deep blue night – with a sun moving across and becoming a moon. The lower scenes are connected by a softly painted floor/landscape continuity. Photoreal cinematic warmth, soft DOF, painterly grade. NO text, NO words. Universal warm-toned dog silhouette, same dog repeated across five moments. Composition: arc above, scene row below, dog visible in each panel. Color palette: dawn pink, midday cerulean, gold, dusk orange, deep night blue, all with warm cream undertones. Avoid: identifiable breeds, modern technology, clutter, anything not domestic, harsh contrast, digital-feeling. Feel: a whole gentle day, distilled.',
  },
  {
    id: 'letter',
    name: 'Letter to My Pet',
    desc: 'Voiceover-driven, each beat a line of the letter.',
    bestFor: [2, 3],
    imagePrompt:
      'A cinematic photoreal intimate image representing a letter-to-my-pet tribute, 3:2 landscape. A close-up overhead view of an open handwritten letter on warm cream paper resting on a soft wooden tabletop, the letter softly out of focus and unreadable so no text is shown – just the impression of cursive writing in soft graphite or fountain pen ink. Beside the letter sits a small bowl of soft amber tea with steam rising, a pressed wildflower, and a slightly out-of-focus dog tag or small worn collar in the upper corner. Late-afternoon window light streams in from the right at a warm 4500K, creating a soft cinematic shadow play. Photoreal painterly grade, shallow depth of field, 50mm lens compression, warm 35mm film stock feel. Composition is intimate, overhead, slightly off-center for natural flow. NO actual readable text, NO recognizable words – the writing is impressionistic and abstract. Color palette: warm cream, ink-blue or sepia, amber tea, soft sage from the pressed flower, walnut wood tones. Mood is hushed, personal, devotional – the act of writing love down. Avoid: any readable letters or words, identifiable handwriting, modern objects, phones, screens, clinical lighting, sharp focus everywhere. Feel: a love letter being written in quiet afternoon light.',
  },
  {
    id: 'greatest_hits',
    name: 'Their Greatest Hits',
    desc: 'A highlight reel of iconic moments.',
    bestFor: [2, 3],
    imagePrompt:
      'A cinematic photoreal collage representing a pet\'s greatest hits highlight reel, 3:2 landscape. A polaroid-photograph wall composition: six warm-toned snapshots arranged in a loose grid, slightly overlapping and tilted at gentle natural angles, pinned to a soft cream cork board or wall. Each polaroid frame shows a different iconic moment of the same universal warm-toned dog: one mid-leap catching a tennis ball, one curled in a sunbeam, one with head out a car window ears flying, one stealing a sock with mischievous joy, one cuddled on a couch beside an unseen owner, one running on a beach at sunset. Each photo has the slight color shift and warm cast of a real polaroid print, with white instant-film borders. Photoreal warmth, cinematic depth of field on the whole composition with the foreground polaroids in sharpest focus. NO text, NO captions, NO dates handwritten on the white borders – borders are blank cream. Universal warm-toned dog silhouette in every shot. Composition: hero polaroid in upper-center, others fanning around it organically. Color palette: warm polaroid amber, cream, soft sun gold, grass green, ocean teal, dusty rose, all unified by polaroid color shift. Mood is celebratory, joyful, deeply alive – a wall of best moments. Avoid: identifiable breeds, digital sharpness, modern phone photos, clinical lighting, any text or writing on photos. Feel: every moment that made them them.',
  },
  {
    id: 'send_off',
    name: 'The Send-Off',
    desc: 'A ceremonial arc – journey, crossing, peace.',
    bestFor: [3, 4],
    imagePrompt:
      'A cinematic photoreal ceremonial image representing the send-off arc of a pet tribute, 3:2 landscape. A single sustained wide shot: a soft pastel cloudscape stretching across the frame at golden-hour pre-sunrise, with a warm gold path of light cutting diagonally from lower-left to upper-right, dissolving into bright soft haze at the horizon. A small warm-toned dog silhouette walks the path roughly two-thirds along, mid-stride, head slightly raised, ears forward – moving toward the light but unhurried, looking back over the shoulder with a final calm glance. The path is rendered as a soft glow rather than concrete ground – clouds and light blending into a journey. A faint rainbow arc curves across the upper third, barely visible like a watercolor wash. Reverent cinematic photoreal painterly grade, 85mm lens compression, soft cinematic depth of field with the dog in sharpest focus and the horizon dissolving in haze. NO text, NO words. Universal warm-toned dog silhouette. Composition: rule-of-thirds, dog at upper-right intersection, path leading from lower-left, horizon at upper-third. Color palette: warm peach, rose-gold, cream, soft lavender, pale amber, with one accent of warm white at the horizon. Mood is ceremonial, peaceful, transcendent – the dignified passage. Avoid: harsh light, dark colors, religious iconography, halos, wings, anything sentimental or kitsch, identifiable breeds, sadness. Feel: the dignified threshold – neither leaving nor arriving, just the crossing.',
  },
  {
    id: 'postcards',
    name: 'Postcards From',
    desc: 'The pet "writes home" from where they are now.',
    bestFor: [2, 3, 4],
    imagePrompt:
      'A cinematic photoreal still life representing a postcards-from-my-pet tribute, 3:2 landscape. A flat-lay overhead view of a stack of vintage postcards scattered loosely on a soft cream linen surface, photoreal painterly grade, late-afternoon golden window light from upper-right casting soft long shadows. Four to five postcards are visible at gentle natural angles, each showing a different impossible idyllic place where the pet might be writing from: a sunlit beach with cliffs, a wildflower meadow at sunset, a soft cloudscape, a cozy fireside cabin, a snowy moonlit forest. The postcards are styled like classic 1960s travel postcards with rounded corners and warm color washes, but no readable text or place-name labels are visible – just the warm idyllic illustration on each. One postcard\'s reverse is visible showing impressionistic abstract handwriting in cursive (no readable words, no signature). A small dried flower, a worn travel stamp without text, and a delicate piece of cream ribbon are tucked among them. Shallow depth of field with the topmost postcard in sharpest focus, others softer. NO readable text anywhere, NO place names, NO words on stamps or postcards. Color palette: warm cream linen, amber postcard washes, dusty pink, sage, soft teal, gold ink. Mood is wistful, hopeful, gently magical – letters arriving from someplace beautiful. Avoid: readable writing, modern stamps, digital-feeling, identifiable specific locations, clutter, harsh shadows. Feel: postcards from somewhere kind.',
  },
  {
    id: 'forever_young',
    name: 'Forever Young',
    desc: 'Imagined alternate timelines if they were still here.',
    bestFor: [3, 4],
    imagePrompt:
      'A cinematic photoreal dreamlike image representing a forever-young tribute – imagined alternate scenes where the pet is still adventuring, 3:2 landscape. A soft layered composition with a slight dream-overlay feel: in the foreground a warm-toned dog mid-run through a wildflower field with golden hour light streaming, slightly out-of-focus translucent ghost-layers of the same dog at three other life moments overlaid like soft film double-exposures – one chasing a butterfly upper-left, one mid-leap toward the sky upper-right, one trotting away into haze along a path. Each ghost layer is at ~30% opacity, creating a feeling of all-possible-futures-at-once. Cinematic photoreal grade with a subtle ethereal lift, soft cinematic depth of field, golden warm color grade with one cool lavender accent for the dream-overlay quality. NO text, NO words. Universal warm-toned dog silhouette repeated across the four layers. Composition: foreground dog at lower-center-left mid-stride, ghost layers fanning upper-right, foreground field of wildflowers leading the eye in. Color palette: warm amber, gold, soft peach, with one accent of pale lavender for the ethereal layers, cream highlights. Mood is hopeful, imaginative, slightly dreamlike – what if they\'re still running. Avoid: identifiable breeds, sad or wistful expressions, dark colors, ghostly horror imagery, harsh edges between overlay layers, digital effects-feeling, clinical lighting. Feel: a parallel timeline where they never stopped running.',
  },
] as const;

// ============================================================================
// THEME CATEGORIES
// ============================================================================

export const themeCategories: readonly ThemeCategory[] = [
  {
    id: 'healing_and_peace',
    name: 'Healing & Peace',
    emoji: '🌅',
    desc: 'soft, hopeful, transcendent',
    themeIds: ['rainbow_bridge', 'sunrise_reunion', 'eternal_garden'],
  },
  {
    id: 'quiet_grief',
    name: 'Quiet Grief',
    emoji: '🌙',
    desc: 'gentle melancholy, space to be sad',
    themeIds: ['gentle_rain', 'moonlight_vigil'],
  },
  {
    id: 'home_and_everyday_love',
    name: 'Home & Everyday Love',
    emoji: '🛋️',
    desc: 'the warmth of ordinary moments',
    themeIds: ['quiet_home', 'beloved_places'],
  },
  {
    id: 'nature_and_freedom',
    name: 'Nature & Freedom',
    emoji: '🌊',
    desc: 'open spaces, wind, release',
    themeIds: ['golden_meadow', 'endless_shore'],
  },
  {
    id: 'their_personality',
    name: 'Their Personality',
    emoji: '🎾',
    desc: 'celebrate who they were',
    themeIds: ['forever_playful', 'nap_champion'],
  },
  {
    id: 'spiritual_and_symbolic',
    name: 'Spiritual & Symbolic',
    emoji: '🌌',
    desc: 'signs, stars, the unseen',
    themeIds: ['starlit_reunion', 'signs_and_symbols'],
  },
] as const;

// ============================================================================
// THEMES — flattened from THEME_CATS in page.tsx, imagePrompts verbatim
// ============================================================================

export const themes: readonly Theme[] = [
  {
    id: 'rainbow_bridge',
    name: 'Rainbow Bridge',
    category: 'healing_and_peace',
    desc: 'Soft cloudscapes, golden light, ethereal crossings.',
    gradient: 'linear-gradient(135deg, #F4D5B5 0%, #E9B888 40%, #C99A6E 100%)',
    imagePrompt:
      'A cinematic photoreal landscape painting of the Rainbow Bridge concept, 4:3 landscape. Soft pastel cloudscape stretching to infinity, golden hour light, a luminous rainbow arcing across the upper third with watercolor softness, warm peach and rose-gold horizon, gentle clouds with the cinematic depth of a Maxfield Parrish painting crossed with Terrence Malick cinematography. A pale soft path of golden light walks the eye into the haze. NO pets visible in this version – pure environment only. NO text. Color palette: warm peach, rose, cream, gold, pale lavender accent, soft white. Mood: transcendent, peaceful, the threshold. Avoid: religious iconography, halos, kitsch, harsh light, dark colors. Feel: an environment of soft arrival.',
  },
  {
    id: 'sunrise_reunion',
    name: 'Sunrise Reunion',
    category: 'healing_and_peace',
    desc: 'Early-morning light, dew on grass, hopeful horizon.',
    gradient: 'linear-gradient(135deg, #F8DCC0 0%, #E8A985 50%, #B4715A 100%)',
    imagePrompt:
      'A cinematic photoreal landscape, 4:3 landscape. Early-morning sunrise breaking over a soft hillside meadow, first light cutting through low ground mist, dew-covered grass catching the warm rose-gold rays, the sun just clearing a soft horizon. A faint path leads through the meadow into the warm glow. The light is the hero. Style: the warm photoreal cinematography of a Days of Heaven sunrise crossed with the painterly grade of an Andrew Wyeth landscape. NO pets, NO people, NO text. Soft cinematic depth of field, 35mm lens, painterly warm grade. Color palette: dawn rose-gold, peach, pale amber, soft mint of dewy grass, with cream highlights and gentle warm shadows. Mood: hopeful renewal, the new day. Avoid: harsh contrast, dark colors, modern objects, anything urban or clinical. Feel: the world waking up warm.',
  },
  {
    // v2.4: eternal_garden added. The v1.3 changelog references "Eternal Garden" for quiet_remembrance;
    // in v2.4 the skill adds it to healing_and_peace as canonical.
    id: 'eternal_garden',
    name: 'Eternal Garden',
    category: 'healing_and_peace',
    desc: 'A peaceful endless garden in soft perpetual bloom – gentle paths between wildflowers, dappled light through arbors, butterflies and quiet birdsong.',
    gradient: 'linear-gradient(135deg, #C8E6C9 0%, #A5D6A7 40%, #66BB6A 100%)',
    imagePrompt:
      'A cinematic photoreal landscape painting of an eternal garden in soft perpetual bloom, 4:3 landscape. Gentle winding paths between beds of wildflowers – poppies, daisies, forget-me-nots – dappled light filtering through wooden garden arbors draped in climbing roses, butterflies drifting lazily through golden afternoon haze, distant soft birdsong suggested by the composition. The garden extends into a warm soft horizon. NO pets visible – pure environment. NO text. Color palette: soft sage green, warm cream, dusty rose, gentle lavender, golden dappled light. Mood: tranquil, hopeful, a resting place of endless gentle blooms. Avoid: religious imagery, harsh light, anything melancholy or dark. Feel: a garden that never ends and never stops blooming.',
  },
  {
    id: 'gentle_rain',
    name: 'Gentle Rain',
    category: 'quiet_grief',
    desc: 'Soft rain on windows, misty paths, muted light.',
    gradient: 'linear-gradient(135deg, #BCC3C8 0%, #8E9AA3 50%, #5C6770 100%)',
    imagePrompt:
      'A cinematic photoreal interior, 4:3 landscape. Close view of a rain-streaked window with soft warm interior light behind it, blurred lights of a peaceful neighborhood through the rain droplets, deep cinematic shallow depth of field – only a few rain droplets in sharpest focus while the rest dissolves into bokeh. A muted gray-blue palette with one warm accent of an interior glow. Style: the contemplative cinematography of Lost in Translation crossed with the muted palette of an Edward Hopper rainy-window study. NO pets, NO people, NO text. Soft 50mm macro lens feel, cinematic grade. Color palette: cool silver-blue, slate, dove gray, with one warm amber accent from interior light. Mood: gentle melancholy, space to feel sad, no forced positivity. Avoid: storms, harsh contrast, drama, scary atmosphere, bright colors. Feel: the room exhales with you.',
  },
  {
    id: 'moonlight_vigil',
    name: 'Moonlight Vigil',
    category: 'quiet_grief',
    desc: 'Soft moonlight, stars, quiet companionship.',
    gradient: 'linear-gradient(135deg, #5C6E8C 0%, #364159 50%, #1E2538 100%)',
    imagePrompt:
      'A cinematic photoreal nightscape, 4:3 landscape. A soft moonlit clearing with tall silhouetted trees framing the sides, the full moon high in a deep indigo sky scattered with quiet stars, soft cool blue moonlight illuminating a dew-covered meadow below, with one small warm amber glow in the lower-center – perhaps a single candle or lantern resting on the ground. Cinematic painterly photoreal grade, deep cool blue with surgical warm accents, the contrast that makes you feel held in the night. Style: the night cinematography of A Ghost Story crossed with the soft mythology of a Maxfield Parrish night scene. NO pets, NO people, NO text. Composition: rule-of-thirds, moon at upper-right, candle warmth at lower-third. Color palette: deep indigo, cool silver-blue, pale moon-cream, with one warm amber-orange accent. Mood: intimate, reflective, quiet companionship with the dark. Avoid: scary atmosphere, ghosts, harsh shadows, religious iconography. Feel: the night keeping vigil with you.',
  },
  {
    id: 'quiet_home',
    name: 'Quiet Home',
    category: 'home_and_everyday_love',
    desc: 'Warm interiors, sunbeams on hardwood, soft light.',
    gradient: 'linear-gradient(135deg, #EBC891 0%, #C9994D 50%, #8C6328 100%)',
    imagePrompt:
      'A cinematic photoreal interior, 4:3 landscape. A warm sunlit living room captured in late-afternoon golden hour: a worn cream-colored couch with a soft folded blanket, sunbeams cutting diagonally across honey-toned hardwood floors, dust motes catching the light, a half-read book face-down on a side table, a ceramic mug, a single houseplant in the warm light. The room is empty of people but radiantly inhabited – the feel of the home you shared. Style: the warm domestic cinematography of Call Me By Your Name crossed with a Vermeer interior – light is the subject. Cinematic photoreal painterly grade, 35mm lens, soft DOF. NO pets, NO people, NO text. Color palette: warm honey, amber, cream, soft butter yellow, with one accent of sage from the houseplant. Mood: warm and lived-in, soft afternoon comfort. Avoid: modern minimalism, harsh light, electronics, anything clinical or staged. Feel: the home you shared at its quietest hour.',
  },
  {
    id: 'beloved_places',
    name: 'Beloved Places',
    category: 'home_and_everyday_love',
    desc: 'The actual world they loved – yard, porch, park.',
    gradient: 'linear-gradient(135deg, #C9C28C 0%, #93915A 50%, #5A5734 100%)',
    imagePrompt:
      'A cinematic photoreal montage of a beloved everyday landscape, 4:3 landscape. A wide shot of a peaceful suburban backyard at late afternoon: a wooden fence line, a familiar patch of sun-warmed grass, an old garden hose coiled neatly, a beloved tennis ball half-tucked under a hedge, a porch step visible at the edge of frame with a worn doormat. The actual world of small daily joys made cinematic. Style: the photoreal warmth of a Sally Mann backyard photograph crossed with the cinematography of Boyhood – ordinary places elevated. Cinematic painterly grade, 35mm lens, soft cinematic DOF. NO pets, NO people, NO text. Color palette: warm grass green, soft amber late-light, weathered wood brown, with one accent of bright tennis-ball yellow. Mood: real, lived, deeply loved – the world they actually knew. Avoid: stylized or fantasy landscapes, anything not believably domestic, harsh light, modern décor, clinical. Feel: the actual world they loved, made cinematic.',
  },
  {
    id: 'golden_meadow',
    name: 'Golden Meadow',
    category: 'nature_and_freedom',
    desc: 'Sunlit fields, wildflowers, late-summer light.',
    gradient: 'linear-gradient(135deg, #E8C570 0%, #B69240 50%, #6A5520 100%)',
    imagePrompt:
      'A cinematic photoreal landscape, 4:3 landscape. A wide sunlit meadow at the height of late summer, tall golden grasses swaying gently with white-yellow wildflowers scattered throughout, an ancient single oak tree off-center providing soft compositional weight, warm late-afternoon amber sun streaming horizontally across the field creating long warm shadows and rim-lit grass blades. The kind of meadow you wandered into as a child. Style: the warm pastoral cinematography of Days of Heaven crossed with the Hudson River School painterly grandeur of an Albert Bierstadt golden field. Cinematic photoreal painterly grade, 35mm lens, generous cinematic depth of field. NO pets, NO people, NO text. Color palette: deep amber gold, warm honey, soft sage, cream highlights, with one accent of dusty pink wildflower. Mood: nostalgic, warm, the eternal late-summer afternoon. Avoid: harsh midday sun, modern objects, identifiable specific places, dark colors, anything urban. Feel: the meadow at the end of every perfect summer.',
  },
  {
    id: 'endless_shore',
    name: 'Endless Shore',
    category: 'nature_and_freedom',
    desc: 'Beach at sunset, pawprints, gentle waves.',
    gradient: 'linear-gradient(135deg, #F2C794 0%, #C28E5A 50%, #5D7B7E 100%)',
    imagePrompt:
      'A cinematic photoreal seascape, 4:3 landscape. A peaceful empty beach at sunset, gentle waves dissolving into wet sand, soft trail of small pawprints meandering from the lower-right corner toward the warm setting sun, fading naturally as they get closer to the water\'s edge. The horizon is wide open with a golden sun half-set, soft cinematic atmosphere with warm gold sky transitioning to soft teal water. Style: the contemplative seascape cinematography of The Tree of Life crossed with the soft palette of a Winslow Homer late-day painting. Cinematic photoreal painterly grade, 35mm lens, wide cinematic depth of field. NO pets visible – only the trace of pawprints. NO people, NO text. Color palette: warm gold, peach, soft amber sky, teal sea, wet-sand silver, cream highlights. Mood: peaceful goodbye, the open horizon, gentle release. Avoid: harsh waves, storms, dark colors, identifiable specific beaches, modern objects, drama. Feel: the trace of where they walked, the horizon ahead.',
  },
  {
    id: 'forever_playful',
    name: 'Forever Playful',
    category: 'their_personality',
    desc: 'Tennis balls, zoomies, mid-bounce joy.',
    gradient: 'linear-gradient(135deg, #F3CD79 0%, #D89A3B 50%, #8E5E1A 100%)',
    imagePrompt:
      'A cinematic photoreal still life, 4:3 landscape. A close-up overhead view of a bright yellow tennis ball captured mid-bounce just above sunlit green grass, motion blur softening its edges, a single blade of grass caught in mid-deflection beneath it, the warm midday sun creating crisp small shadow. The single object holds all the energy of every zoomie that ever happened. Style: the joyful object-photography of a Wes Anderson title card crossed with the painterly photorealism of a Carl Larsson everyday-scene watercolor. Cinematic photoreal painterly grade, 50mm macro lens, shallow cinematic DOF with the ball in sharpest focus. NO pets visible, NO people, NO text. Color palette: bright tennis yellow, warm grass green, soft sun-amber, cream highlights. Mood: pure aliveness made into a single still object, joyful energy. Avoid: identifiable brand markings on the tennis ball, modern context, harsh shadows, anything sad. Feel: a single tennis ball that contains an entire life of joy.',
  },
  {
    id: 'nap_champion',
    name: 'Nap Champion',
    category: 'their_personality',
    desc: 'Soft blankets, sleepy warmth, peaceful breathing.',
    gradient: 'linear-gradient(135deg, #EFD9B4 0%, #C9A077 50%, #876043 100%)',
    imagePrompt:
      'A cinematic photoreal interior still life, 4:3 landscape. A close intimate view of an empty soft cream blanket nest curled into the corner of a worn loved-in couch cushion, a small indent where a dog clearly slept many afternoons, late afternoon golden window light slanting across the soft fabric folds creating warm shadow play, a single dog hair catching the light. The absence of the dog is the subject. Style: the intimate domestic still life cinematography of a Sofia Coppola film crossed with the soft palette of a Carl Larsson interior. Cinematic photoreal painterly grade, 50mm lens, shallow DOF with the indent in sharpest focus. NO pets, NO people, NO text. Color palette: warm cream, soft butter, dusty rose, warm amber light, with one accent of sage. Mood: peaceful contentment, the warm trace of a beloved presence. Avoid: anything sad, harsh light, modern objects, clinical, sterile. Feel: the nest still holds their warmth.',
  },
  {
    id: 'starlit_reunion',
    name: 'Starlit Reunion',
    category: 'spiritual_and_symbolic',
    desc: 'Celestial sky, gentle nebulas, cosmic companionship.',
    gradient: 'linear-gradient(135deg, #4A5380 0%, #2C2D52 50%, #14152D 100%)',
    imagePrompt:
      'A cinematic photoreal astrophotography image, 4:3 landscape. A deep indigo night sky scattered with thousands of soft stars and a faint warm-toned nebula spread across the upper-third, subtle wisps of gold and dusty rose nebular cloud. In the lower portion a faint silhouette of distant gentle hills, with a single small warm light somewhere on the horizon. The cosmos as gentle company. Style: the contemplative night cinematography of Tree of Life crossed with the soft astrophotography palette of a Hubble deep field but warmer and friendlier. Cinematic photoreal painterly grade, wide lens, deep cinematic clarity. NO pets, NO people, NO constellations resembling specific dogs, NO text. Color palette: deep indigo, cool midnight blue, with warm nebular accents of rose-gold, peach, soft amber, cream-white stars. Mood: cosmic companionship, the universe quietly present. Avoid: religious iconography, halos, ghostly imagery, recognizable constellations or shapes, harsh contrast, scary atmosphere. Feel: the stars keeping company with you.',
  },
  {
    id: 'signs_and_symbols',
    name: 'Signs & Symbols',
    category: 'spiritual_and_symbolic',
    desc: 'Butterflies, feathers, dragonflies – the visits.',
    gradient: 'linear-gradient(135deg, #D4B89C 0%, #A88259 50%, #5E4528 100%)',
    imagePrompt:
      'A cinematic photoreal close-up still life, 4:3 landscape. A single soft white-and-cream feather drifting through warm afternoon light, suspended in air with a faint iridescent shimmer along its edge, soft dappled tree-canopy light dancing on the background as warm bokeh, a hint of butterfly wing in the upper-right corner just barely in frame. Soft slow-motion-feel even though it\'s a still. Style: the dreamy soft natural cinematography of Wong Kar-wai\'s daylight scenes crossed with the warmth of a Vilhelm Hammershøi window-light study. Cinematic photoreal painterly grade, 85mm lens, very shallow cinematic DOF with the feather in sharpest focus and everything else dissolved. NO pets, NO people, NO text. Color palette: warm cream feather, soft amber dappled light, sage and dusty green bokeh, one accent of pale iridescent blue or violet. Mood: a gentle visit, the unseen made briefly visible. Avoid: heavy symbolism, religious iconography, ghosts, harsh light, clinical sharpness across the whole frame. Feel: the feather you find on the morning walk.',
  },
] as const;

// ============================================================================
// ART STYLES — verbatim from STYLES in page.tsx, directive from skill YAML
// ============================================================================

export const artStyles: readonly ArtStyle[] = [
  {
    id: 'cinematic_realism',
    name: 'Cinematic Realism',
    emoji: '🎬',
    desc: 'Soft photoreal, warm cinematic lighting.',
    directive:
      'Cinematic painterly photorealism. Soft warm color grade, gentle natural lighting, slight cinematic depth of field, photoreal textures and fur detail. Reverent, intimate, real.',
    eligibleForCuratorsPick: true,
    imagePrompt:
      'A cinematic painterly photorealism portrait of a generic warm-toned dog, 1:1 square format. Three-quarter portrait, dog sitting upright in soft golden-hour light, eyes catching warm rim-light, fur showing photoreal texture and slight subsurface detail, gentle natural lighting from a soft window source, slight cinematic depth of field with background dissolved into warm bokeh. Style: the photoreal cinematography of Roger Deakins crossed with a warm Vermeer-style natural-light portrait. Painterly photoreal grade, 50mm lens, shallow DOF, reverent intimate framing. NO text, NO captions. Universal warm tan-and-cream dog – not breed-specific, gentle expressive face. Color palette: warm honey, amber, cream, soft brown, with one accent of warm light catching the iris. Mood: reverent, intimate, real – the way you actually saw them in the best afternoon light. Avoid: cartoonish features, painterly abstraction, identifiable breeds, harsh shadows, anything stylized away from photoreal.',
  },
  {
    id: 'watercolor',
    name: 'Watercolor',
    emoji: '🎨',
    desc: 'Bleeding pigments, soft brushwork, memorial-portrait warmth.',
    directive:
      'Soft watercolor painting style throughout. Bleeding edges, gentle pigment washes, visible paper texture, muted warm palette (cream, rose, soft ochre, dusty teal), soft white highlights left unpainted, every contour dissolved into watery softness. Hand-painted memorial portrait feel.',
    eligibleForCuratorsPick: true,
    imagePrompt:
      'A soft watercolor painting portrait of a generic warm-toned dog, 1:1 square format. Three-quarter portrait of a gentle dog with soft pigment washes – visible bleeding edges where colors dissolve into warm cream paper, pigment pools settling at contours and fur lines, soft unpainted highlights where the paper shows through (especially on the chest, top of head, eye highlights), visible cold-press paper texture throughout the whole image. Pigments are loose, watery, and translucent – never solid or filled-in. Color palette: cream, soft rose, dusty ochre, warm sienna, with a faint dusty-teal accent in the shadow areas. Style: the memorial-portrait watercolor tradition of Andrew Wyeth\'s portrait sketches crossed with the soft pigment bleed of a Jenny Saville study. The painting feels hand-painted with a #4 round sable brush on Arches cold-press paper. NO text, NO signatures, NO captions. Universal warm-toned dog, gentle face, not breed-specific. Background is empty cream paper showing brushwork tests at the edges. Mood: deeply tender, hand-made, the oldest memorial form. Avoid: digital cleanness, hard outlines, vivid saturated colors, photoreal detail, identifiable breeds, decorative borders. Feel: a watercolor portrait you\'d frame and keep forever.',
  },
  {
    id: 'storybook_illustration',
    name: 'Storybook',
    emoji: '✏️',
    desc: "Hand-drawn children's-book warmth, painted softly.",
    directive:
      "Hand-drawn children's storybook illustration style. Soft pencil-and-paint texture, gentle rounded shapes, warm pastel palette, hand-painted backgrounds with visible brushstrokes, a slight printed-page warmth. Tender, timeless, like a beloved picture-book illustration.",
    eligibleForCuratorsPick: true,
    imagePrompt:
      "A hand-drawn children's storybook illustration, 1:1 square format. A friendly warm-toned cartoon dog standing on a soft grassy hill with a small daisy patch at its feet, a sun overhead with hand-painted yellow rays, a single butterfly drifting in the upper-right corner. The art style is hand-painted with visible soft pencil construction lines beneath the paint, gouache or soft acrylic texture, gentle rounded shapes throughout, warm pastel palette, the slight printed-page warmth and texture of a vintage children's book. Style references: Beatrix Potter's tender warmth, Garth Williams' Charlotte's Web illustrations, Jon Klassen's restraint, Oliver Jeffers' painterly affection. The dog is universal – friendly rounded silhouette painted with affectionate simplicity, gentle smile, expressive black-dot eyes. NO text, NO words, NO page numbers. Color palette: warm cream paper tone, dusty sage green grass, soft amber dog, sun yellow, dusty pink daisy centers, gentle sky blue. Mood: timeless, picture-book warm – a Sunday-evening bedtime story page. Avoid: digital cleanness, sharp outlines, modern style, photoreal textures, anything edgy or contemporary, identifiable breeds. Feel: an illustration from a beloved childhood book.",
  },
  {
    id: 'animated_3d',
    name: '3D Animated',
    emoji: '🧸',
    desc: 'Pixar warmth, soft volumes, expressive eyes.',
    directive:
      'Modern 3D animated film style, in the warm tradition of Pixar and Disney feature animation. Soft rounded volumes, expressive eyes with subtle highlights, gentle subsurface scattering on fur, cinematic three-point lighting, warm color grade, slight depth of field. Tender and emotive, the feel of a beloved animated film. Not photoreal, not cartoonish – that loving middle ground modern 3D animation occupies.',
    eligibleForCuratorsPick: true,
    imagePrompt:
      "A modern 3D animated film-style portrait of a generic warm-toned dog, 1:1 square format. Three-quarter portrait of a stylized dog with soft rounded volumes, large expressive eyes with multiple highlight catchlights, gentle subsurface scattering on fur tips making them glow in the warm light, soft fur grooming with directional flow, cinematic three-point lighting (key from upper-left, fill from front, rim from upper-right), warm color grade, slight cinematic depth of field. Style: the warm tradition of Pixar's character portraits crossed with the soft volumetric polish of Disney's modern animated features. Render quality is high-end feature-animation. NO text, NO captions, NO logos. Universal warm-toned dog with a gentle expressive smile and slightly tilted head, large soulful eyes – not breed-specific but reads as 'every good dog'. Background is a soft warm bokeh of indeterminate domestic context. Color palette: warm amber, gold, soft cream, deep chocolate accents in the eyes and nose, with one warm orange rim light. Mood: tender and emotive, the feel of a beloved animated film character right before a softly emotional moment. Avoid: photoreal textures, sharp realism, identifiable breeds, harsh lighting, anything cold or sterile. Feel: a feature-film character you'd already love by the second scene.",
  },
  {
    id: 'claymation',
    name: 'Claymation',
    emoji: '🤏',
    desc: 'Aardman-style hand-sculpted stop-motion.',
    directive:
      'Stop-motion claymation style in the Aardman/Laika tradition. Hand-sculpted plasticine clay figures with visible thumbprints and tooling marks on the clay surface, slightly imperfect handcrafted forms, soft warm tungsten studio lighting on a miniature tabletop diorama, hand-bent wire and paper elements, tactile fabric and clay textures. Handmade, soulful, intimate – the feel of a beloved stop-motion short film.',
    eligibleForCuratorsPick: true,
    imagePrompt:
      "A stop-motion claymation-style portrait of a generic warm-toned dog, 1:1 square format. A hand-sculpted plasticine clay dog sitting on a miniature tabletop diorama with a tiny patch of fabric grass and a small handmade wooden fence behind it. Visible thumbprints and tooling marks across the clay surface – the clay shows its handmade nature openly: slight imperfections in symmetry, soft tool marks in the fur sculpting, the seam where two clay colors meet. The clay is lit by soft warm tungsten studio light from upper-left, creating gentle shadows that hint at the table surface and ceiling of the diorama. The dog has clay-made eyes (small black plasticine balls with painted-on highlights) and a tiny clay tongue. Style: the warm tactile tradition of Aardman Animations (Wallace & Gromit) crossed with the Laika studio polish (Coraline, Kubo). The whole image feels like a still from a beloved stop-motion short film. NO text, NO captions. Universal warm-toned clay dog, friendly proportions, not breed-specific. Color palette: warm terracotta clay browns, soft tan, cream highlights, with one accent of green clay grass. Mood: handmade soulful intimacy, tactile warmth. Avoid: digital smoothness, photoreal textures, perfect symmetry, sharp clean lighting, identifiable breeds. Feel: someone built this dog with their hands, one careful afternoon.",
  },
  {
    id: 'pencil_sketch',
    name: 'Pencil Sketch',
    emoji: '📝',
    desc: 'Graphite on warm paper, the oldest memorial form.',
    directive:
      'Fine graphite pencil sketch portrait on warm cream paper. Visible cross-hatching and feather-light shading, expressive line weight, soft smudged highlights, the slight grain of textured drawing paper, occasional construction lines left visible. Hand-drawn warmth, like a beloved framed memorial sketch in a family home. Monochromatic with warm paper tone, no color flooding, no painting – just pencil.',
    eligibleForCuratorsPick: true,
    imagePrompt:
      "A fine graphite pencil sketch portrait of a generic warm-toned dog, 1:1 square format. Three-quarter portrait drawn on warm cream paper with visible texture showing through. The drawing uses expressive line weight – heavier confident lines on the major contours and lighter feathered lines for fur direction. Visible cross-hatching for shading on the body and face shadows, feather-light shading on the lighter areas, soft smudged graphite highlights blended with a finger or tortillon, the slight grain of textured drawing paper showing through everywhere, occasional construction lines left visible to show the artist's process. Monochromatic – only graphite tones and the warm paper underneath, no color. Style: the memorial pencil-portrait tradition of a Käthe Kollwitz portrait study crossed with the precision of a John Singer Sargent figure sketch. NO text, NO signatures (drawing only). Universal warm-toned dog, gentle expressive face, not breed-specific. Background is empty cream paper showing slight texture. The drawing fills about 70% of the frame, generous white space around. Color palette: graphite grays from soft silver to deep charcoal, on a warm cream paper that provides the only color. Mood: classical, restrained, the oldest form of memorial portrait. Avoid: any color flooding, painting, digital cleanness, sharp uniform lines, identifiable breeds, decorative borders. Feel: a graphite memorial sketch that has been in someone's home for decades.",
  },
  {
    id: 'pixel_art',
    name: 'Pixel Art',
    emoji: '🟪',
    desc: '16-bit retro warmth, joyful nostalgia.',
    directive:
      '16-bit pixel art style in the tradition of beloved retro video games. Limited warm color palette, hand-pixeled sprites with clean readable silhouettes, dithered shading on volumes, soft chunky pixels, gentle scanline texture. Affectionate, nostalgic, joyful – the way a long-loved game character is rendered. Vertical 9:16 framing preserves pixel grid alignment.',
    eligibleForCuratorsPick: false,
    imagePrompt:
      'A 16-bit pixel art portrait of a generic warm-toned dog, 1:1 square format, rendered with crisp pixel-perfect edges (NO anti-aliasing, NO smoothing). The dog is hand-pixeled with a clean readable silhouette – chunky satisfying pixels at roughly 64x64 resolution upscaled, dithered shading for volume on the body, the dog facing slightly right and sitting upright. Limited warm color palette of maybe 12-16 colors total: warm tan body, cream chest, deep brown nose and eye outlines, two small white eye-highlight pixels, soft pink tongue, with the background a soft warm sky gradient (peach to amber, dithered transition between bands), green grass strip along the bottom with hand-pixeled flower dots. A small sun in the upper-left corner made of yellow pixels with hand-placed rays. Style: the warm pixel-art tradition of Stardew Valley crossed with the sprite-craft of Owlboy or Celeste – affectionate, nostalgic, joyful. NO text, NO HUD elements, NO score displays. Universal warm-toned dog sprite, friendly rounded pixel shape, not breed-specific. Color palette: warm tans, cream, peach sky, dithered amber, grass green, hand-pixeled flowers in dusty pink. Mood: nostalgic, joyful, the affectionate way a long-loved game character is rendered. Avoid: smooth gradients, anti-aliased edges, digital-feeling rendering, photoreal textures, identifiable breeds, modern game UI. Feel: a sprite from a game you\'ve played for years.',
  },
  {
    id: 'voxel_minecraft',
    name: 'Voxel',
    emoji: '🧊',
    desc: 'Blocky world, friendly, especially fitting for kids.',
    directive:
      'Voxel block art style in the visual language of Minecraft. Cubic blocks form every shape – pet, flowers, sky, ground – with simple textured faces, soft AO shading at block edges, friendly chunky proportions, gentle warm lighting on the voxel world. Cheerful and approachable, the way a family memorial built in a child\'s favorite game would feel.',
    eligibleForCuratorsPick: false,
    imagePrompt:
      'A voxel block-art portrait of a generic warm-toned dog in the visual language of Minecraft, 1:1 square format. The dog is constructed from a small number of clean cubic voxel blocks – head, body, four legs, tail – sitting on a small platform of grass-block voxels with a few flower-block voxels nearby. Each block face is textured with a simple low-fi pixel texture (visible Minecraft-style noise pattern on each face). Soft ambient occlusion shading at block edges where blocks meet creating gentle realistic darkness in the seams. Warm gentle three-quarter top-down view, isometric-feel but slightly off-isometric for a friendly perspective. Soft warm yellow sun light from upper-left creating crisp clean block shadows. A few simple cloud-blocks in a soft pixel sky in the upper background. Style: pure Minecraft visual language – affectionate, blocky, instantly recognizable to any kid who plays – crossed with a slight handmade craftsiness. NO text, NO HUD elements, NO inventory UI, NO username tags. Universal warm-toned dog made of friendly chunky proportions (roughly 1 block head, 2 block body, 1 block legs), not breed-specific. Color palette: warm tan blocks, cream face, dark brown eye-blocks, green grass blocks, dirt brown underneath, soft sky blue, with one red flower-block accent. Mood: cheerful, approachable, family-friendly – the way a child memorial built in their favorite game would feel. Avoid: photoreal textures, smooth shading, anti-aliased edges, modern photoreal rendering, anything that breaks the block aesthetic, identifiable breeds. Feel: a tribute built block by block in the game a child loves.',
  },
] as const;

// ============================================================================
// CAPTION CONTAINERS — 13 total (8 style-paired + 5 memorial)
// ============================================================================

export const captionContainers: readonly CaptionContainer[] = [
  // --- Style-paired (8) ---
  {
    id: 'cinematic_lower_third',
    name: 'Cinematic lower-third',
    group: 'style_paired',
    pairedStyle: 'cinematic_realism',
    leafIcon: false,
    spec: 'Soft dark cinematic lower-third gradient bar — the only container where a UI-bar treatment is acceptable, because it matches actual film convention. Spans ~80% of frame width, centered in the lower portion of the frame. Dark translucent gradient base #0E0E12 fading to transparent at the top edge, festival-card italic serif text in warm white #F4F1E8. Casts a soft drop shadow onto the scene below. An illustrated decorative object, identical specification on every scene in the storybook.',
  },
  {
    id: 'watercolor_ribbon',
    name: 'Watercolor ribbon',
    group: 'style_paired',
    pairedStyle: 'watercolor',
    leafIcon: false,
    spec: 'A painted ribbon with hand-painted bleeding watercolor edges and soft tape-corner attachments at the top. Spans ~80% of frame width, centered in the lower portion of the frame. Soft cream wash base color #F1E7D2 with bleeding rose and ochre edges, sepia brush-calligraphy text #6B4A2E. Casts a soft watercolor drop shadow onto the scene below. Not a UI bar — an illustrated decorative object, identical specification on every scene in the storybook.',
  },
  {
    id: 'storybook_page',
    name: 'Storybook page',
    group: 'style_paired',
    pairedStyle: 'storybook_illustration',
    leafIcon: false,
    spec: 'An open page from a children\'s picture book — cream paper with a subtle wildflower ornament in the corner and a dog-eared edge. Spans ~80% of frame width, centered in the lower portion of the frame. Cream paper base color #F3E9CF with visible paper texture, warm brown serif text #5A3E1F. Casts a soft drop shadow onto the scene below. Not a UI bar — an illustrated decorative object, identical specification on every scene in the storybook.',
  },
  {
    id: 'parchment_scroll',
    name: 'Parchment scroll',
    group: 'style_paired',
    pairedStyle: 'animated_3d',
    leafIcon: false,
    spec: 'A horizontal parchment scroll with rolled curled ends on both sides and a thin warm brown outlined border. Spans ~80% of frame width, centered in the lower portion of the frame. Warm tan #E8D9B5 paper texture, dark brown #5A3E1F Pixar-storybook serif type centered. Casts a soft drop shadow onto the scene below. Not a UI bar — an illustrated decorative object, identical specification on every scene in the storybook.',
  },
  {
    id: 'plasticine_banner',
    name: 'Plasticine banner',
    group: 'style_paired',
    pairedStyle: 'claymation',
    leafIcon: false,
    spec: 'A sculpted plasticine banner physically sitting in the diorama — made of plasticine with visible thumbprints, a thin black outline, and dimensional rolled edges, holding hand-shaped clay letters. Spans ~80% of frame width, centered in the lower portion of the frame. Warm clay base color #D9B98E, dark clay letters #3A2A1C. Casts a soft drop shadow onto the scene below. Not a UI bar — an illustrated decorative object, identical specification on every scene in the storybook.',
  },
  {
    id: 'paperclip_note',
    name: 'Paperclip note',
    group: 'style_paired',
    pairedStyle: 'pencil_sketch',
    leafIcon: false,
    spec: 'A small loose sheet of warm cream paper drawn in pencil, attached to the scene with a hand-drawn paperclip or piece of washi tape. Spans ~80% of frame width, centered in the lower portion of the frame. Warm cream paper base color #EFE6D2, graphite cursive text #3C3A36. Casts a soft pencil-shaded drop shadow onto the scene below. Not a UI bar — an illustrated decorative object, identical specification on every scene in the storybook.',
  },
  {
    id: 'pixel_sign',
    name: 'Pixel sign',
    group: 'style_paired',
    pairedStyle: 'pixel_art',
    leafIcon: false,
    spec: 'A pixel-art wooden sign or carved stone tablet built from pixels, hanging from pixel-art chains or planted in the ground, with a chunky pixel border. Spans ~80% of frame width, centered in the lower portion of the frame. Wood-brown pixel base color #8A5A33, 8-bit bitmap caps text in cream #F2E4C4. Casts a chunky pixel drop shadow onto the scene below. Not a UI bar — an illustrated decorative object, identical specification on every scene in the storybook.',
  },
  {
    id: 'voxel_sign',
    name: 'Voxel sign',
    group: 'style_paired',
    pairedStyle: 'voxel_minecraft',
    leafIcon: false,
    spec: 'A three-dimensional voxel sign block or Minecraft-style hanging banner built entirely from cubes, with ambient-occlusion shadows underneath, holding voxel-block text. Spans ~80% of frame width, centered in the lower portion of the frame. Oak-wood voxel base color #9C6B3C, dark voxel-block letters #2E2418. Casts a soft ambient-occlusion drop shadow onto the scene below. Not a UI bar — an illustrated decorative object, identical specification on every scene in the storybook.',
  },
  // --- Memorial (5) ---
  {
    id: 'engraved_stone_plaque',
    name: 'Engraved stone plaque',
    group: 'memorial',
    leafIcon: true,
    spec: 'A rectangular engraved stone plaque (granite or marble), spanning ~80% of frame width, centered lower-third. Visible stone texture and grain, soft natural moss along the bottom edge, deeply carved chiseled letters with subtle shadow inside each letter cut. Stone base color #8B8378 with #4A4540 letter shadows. Casts a solid drop shadow onto the scene below. Not a UI bar — a real stone memorial object. Text inside is dignified carved serif. Identical specification on every scene in the storybook.',
  },
  {
    id: 'polaroid_border',
    name: 'Polaroid border',
    group: 'memorial',
    leafIcon: true,
    spec: 'The frame composition itself sits inside a white Polaroid border. White polaroid frame color #F8F4EC with subtle aged warm-tan tinting at the edges, a wide bottom margin where the handwritten caption goes. Soft natural drop shadow as if the polaroid is laid on a surface, with one very slight tilt off-axis (1-2 degrees). Caption is handwritten in warm navy ink #2A3855 ballpoint pen script, slightly imperfect. Not a UI bar — a real polaroid object. Identical specification on every scene in the storybook.',
  },
  {
    id: 'postcard_back',
    name: 'Postcard back',
    group: 'memorial',
    leafIcon: true,
    spec: 'The frame composition sits behind/inside a vintage postcard. Cream postcard cardstock #F0E5C8 with a subtle pre-printed thin dividing line down the middle. The top-right corner has a small vintage postage stamp and a circular postmark. Handwritten message in warm dark blue #1F3A5C cursive ink fills the left half. Soft natural drop shadow. Not a UI bar — a real postcard object placed within the scene composition. Identical specification on every scene in the storybook.',
  },
  {
    id: 'embroidered_sampler',
    name: 'Embroidered sampler',
    group: 'memorial',
    leafIcon: true,
    spec: 'A circular wooden embroidery hoop containing cream linen fabric, spanning ~80% of frame width, centered lower-third. Visible wooden hoop ring #8B5A2B around the edge with a subtle metal tensioner, cream linen #F4EAD5 inside with a subtle weave texture, cross-stitch lettering in warm rose-red thread #C84A4A or soft moss-green #6B7A4C with visible thread X-stitches forming each letter, small embroidered wildflower motifs in the corners. Casts a soft drop shadow. Not a UI bar — a real embroidered sampler. Identical specification on every scene in the storybook.',
  },
  {
    id: 'pressed_flower_bookmark',
    name: 'Pressed-flower bookmark',
    group: 'memorial',
    leafIcon: true,
    spec: 'A vintage botanical card or bookmark of warm cream cardstock #ECDFC5 with deckled edges, spanning ~80% of frame width, centered lower-third. Several dried pressed wildflowers (poppies, daisies, forget-me-nots) pressed into the card alongside the text, with visible thin pressed leaves and stems. Text in warm sepia ink #5A3520 elegant serif. Subtle paper grain. Casts a soft drop shadow. Not a UI bar — a real botanical bookmark object. Identical specification on every scene in the storybook.',
  },
] as const;

// Helper: returns the style-paired ContainerId for a given ArtStyleId.
// Used by CaptionContainer.tsx to pre-highlight the "Recommended for your style" default.
export function containerForStyle(style: ArtStyleId): ContainerId {
  const map: Record<ArtStyleId, ContainerId> = {
    cinematic_realism: 'cinematic_lower_third',
    watercolor: 'watercolor_ribbon',
    storybook_illustration: 'storybook_page',
    animated_3d: 'parchment_scroll',
    claymation: 'plasticine_banner',
    pencil_sketch: 'paperclip_note',
    pixel_art: 'pixel_sign',
    voxel_minecraft: 'voxel_sign',
  };
  return map[style];
}

// ============================================================================
// CURATOR'S PICKS — 4 original + 2 added (v1.3/v2.4)
// ============================================================================

// Verify at module load: all curator's pick styles must be from the warm group (styles 1–6).
const _warmStyles: ArtStyleId[] = [
  'cinematic_realism',
  'watercolor',
  'storybook_illustration',
  'animated_3d',
  'claymation',
  'pencil_sketch',
];

export const curatorsPicks: readonly CuratorPick[] = (() => {
  const picks: CuratorPick[] = [
    {
      id: 'classic_send_off',
      name: 'The Classic Send-Off',
      format: 'send_off',
      theme: 'rainbow_bridge',
      style: 'cinematic_realism',
      tagline: 'A traditional, ceremonial goodbye.',
      container: containerForStyle('cinematic_realism'),
      imagePrompt:
        'A cinematic photorealistic memorial portrait, 4:3 landscape orientation. A soft golden-retriever silhouette stands at the threshold of a pastel cloudscape at sunrise, warm peach and rose-gold sky behind, soft diffuse golden hour light. A faint rainbow arcs across the upper-right corner. The dog is rendered with reverent realism – sun catches the rim of its fur in a halo, eyes closed peacefully, head slightly raised as if listening. Foreground is a meadow of pale wildflowers dissolving into soft mist. The mood is gentle, ceremonial, transcendent – like the final frame of a Terrence Malick film. Soft cinematic depth of field, painterly photoreal grade, warm 35mm film stock feel with delicate grain. NO text, NO words, NO captions, NO watermarks. Subject is universal – not breed-specific, gentle silhouette that could read as any beloved dog. Composition: rule of thirds with dog at lower-right, horizon at upper third, rainbow leading the eye. Color palette: warm peach, rose, soft gold, cream, with one accent of pale lavender. Avoid: harsh shadows, dark colors, anything sad or clinical, identifiable breeds, religious iconography, halos, wings. Feel: the moment just before crossing – peaceful arrival, not departure.',
    },
    {
      id: 'joyful_celebration',
      name: 'Joyful Celebration',
      format: 'greatest_hits',
      theme: 'golden_meadow',
      style: 'cinematic_realism',
      tagline: 'Their best moments, sun-drenched and warm.',
      container: containerForStyle('cinematic_realism'),
      imagePrompt:
        'A cinematic photorealistic memorial image, 4:3 landscape orientation. A medium-sized dog mid-leap through a sunlit summer meadow at golden hour, ears flying, tongue out in pure joy, late-afternoon amber sun streaming through tall golden grasses. Wildflower petals and grass seeds suspended in the air like confetti, backlit by warm gold light. The dog is captured in motion freeze with a slight motion-blur on extremities – full aliveness, no stillness. Background dissolves into shallow cinematic bokeh of warm grasses and wildflowers. Mood is celebratory, sun-drenched, life-affirming – the visual feel of an Anthropologie summer campaign crossed with a Sundance documentary. Warm 35mm film grade, soft cinematic depth of field, golden-hour rim light along the dog\'s silhouette. NO text, NO words. Subject is universal – generic warm-toned dog, not breed-specific. Composition: dog centered or slight left-of-center, mid-air, with sun source at upper right creating lens flare. Color palette: amber, gold, warm green, cream, soft pink wildflowers. Avoid: sadness, clinical lighting, harsh shadows, urban backgrounds, modern objects, identifiable breeds, anything cold-toned. Feel: pure joyful aliveness – their happiest moment, frozen.',
    },
    {
      id: 'quiet_goodbye',
      name: 'The Quiet Goodbye',
      format: 'letter',
      theme: 'quiet_home',
      style: 'watercolor',
      tagline: 'An intimate letter, in the home you shared.',
      container: containerForStyle('watercolor'),
      imagePrompt:
        'A delicate watercolor painting, 4:3 landscape orientation. A small soft-edged dog curled asleep on a worn cream-colored couch in a sunlit living room, late-afternoon golden window light streaming across the scene from the right. Visible warm wooden floor, a soft folded blanket, a half-open book face-down on a cushion nearby, a ceramic mug with steam rising on a side table. The watercolor technique shows bleeding pigment edges, pigment pools settling at contours, soft unpainted highlights where the paper shows through, visible cold-press paper texture throughout. Color palette is muted and warm: cream, dusty rose, soft ochre, pale teal accent on the mug, soft amber light. The dog is universal in form – gentle silhouette, no breed-specific markings. Mood is intimate, hushed, deeply domestic – the quietest possible moment in a beloved home. Style references: Beatrix Potter\'s tender domesticity, Edward Gorey\'s restraint without his darkness, the soft palette of a Jenny Saville watercolor study. NO text, NO words, NO signatures. Composition: dog at lower center, window light source at upper right, soft compositional triangle from window through dog to foreground objects. Avoid: digital cleanness, hard outlines, vivid saturated colors, busy backgrounds, identifiable breeds, religious or sentimental icons, harsh shadows. Feel: the room exhales – peaceful afternoon nap in the home they loved most.',
    },
    {
      id: 'storybook_for_them',
      name: 'A Storybook for Them',
      format: 'biopic',
      theme: 'beloved_places',
      style: 'storybook_illustration',
      tagline: 'Their life, painted like a beloved picture book.',
      container: containerForStyle('storybook_illustration'),
      imagePrompt:
        "A hand-drawn children's storybook illustration, 4:3 landscape orientation. A small warm-toned cartoon dog stands on a grassy hilltop overlooking a rolling pastoral landscape – a tiny cottage with a red door in the middle distance, soft round hills receding into hazy blue, a winding dirt path, a pair of trees with soft round canopies, a few sheep dots in the far meadow. The art style is hand-painted with visible soft pencil construction lines beneath the paint, gouache or soft acrylic texture, gentle rounded shapes throughout, warm pastel palette with the slight printed-page warmth of a vintage children's book. Style references: Beatrix Potter's pastoral tenderness, Garth Williams' Charlotte's Web illustrations, Jon Klassen's restraint, Oliver Jeffers' painterly warmth. The dog is universal – rounded friendly silhouette, not breed-specific, painted with affectionate simplicity. The sun is a soft yellow disc upper-left with a few faint hand-drawn rays. A few small painted wildflowers in the foreground grass. Mood is timeless, tender, picture-book warm – the kind of image that could be a Sunday-evening bedtime story page. NO text, NO words, NO page numbers. Composition: dog at center-left silhouetted against horizon, cottage at middle-right, foreground grass leading the eye in. Color palette: warm cream paper tone, dusty sage green, soft amber, dusty pink, gentle sky blue, brick red accent on cottage door. Avoid: digital cleanness, sharp outlines, modern style, photoreal textures, anything edgy or contemporary, identifiable breeds. Feel: a beloved picture-book illustration the family will turn back to for years.",
    },
    // v1.3 / v2.4 addition: quiet_remembrance uses eternal_garden (added in v2.4 YAML).
    // The v1.3 changelog referenced "Eternal Garden" which the original themes block lacked;
    // v2.4 adds eternal_garden to healing_and_peace, so we map here directly.
    {
      id: 'quiet_remembrance',
      name: 'Quiet Remembrance',
      format: 'letter',
      theme: 'eternal_garden',
      style: 'watercolor',
      tagline: 'A soft remembrance among endless blooms.',
      container: 'pressed_flower_bookmark',
    },
    // v1.3 / v2.4 addition
    {
      id: 'forever_in_stone',
      name: 'Forever in Stone',
      format: 'send_off',
      theme: 'beloved_places',
      style: 'cinematic_realism',
      tagline: 'A lasting tribute, carved and kept.',
      container: 'engraved_stone_plaque',
    },
  ];

  // Runtime assertion: all curator pick styles must be warm-group styles 1–6
  picks.forEach((p) => {
    console.assert(
      _warmStyles.includes(p.style),
      `curatorsPicks: pick "${p.id}" uses style "${p.style}" which is not in the warm group`,
    );
  });

  return picks;
})() as readonly CuratorPick[];

// ============================================================================
// RELATIONSHIPS — from skill YAML
// ============================================================================

export const relationships: readonly Relationship[] = [
  {
    id: 'childhood',
    label: 'The childhood pet I grew up with',
    defaultThemeBias: ['beloved_places', 'golden_meadow'],
    defaultStyleBias: ['storybook_illustration', 'watercolor'],
    narrationTone: 'nostalgic',
    curatorsPickPriority: 'storybook_for_them',
  },
  {
    id: 'partnership',
    label: 'The pet we adopted together',
    defaultThemeBias: ['quiet_home', 'beloved_places'],
    defaultStyleBias: ['cinematic_realism', 'watercolor'],
    narrationTone: 'shared_love',
    curatorsPickPriority: 'quiet_goodbye',
  },
  {
    id: 'companion_through_grief',
    label: 'The pet who got me through a hard time',
    defaultThemeBias: ['quiet_home', 'gentle_rain', 'moonlight_vigil'],
    defaultStyleBias: ['watercolor'],
    narrationTone: 'gratitude_deep',
    curatorsPickPriority: 'quiet_goodbye',
  },
  {
    id: 'family_first',
    label: "My family's first pet — for my kids",
    defaultThemeBias: ['forever_playful', 'golden_meadow', 'beloved_places'],
    defaultStyleBias: ['storybook_illustration'],
    narrationTone: 'warm_familial',
    curatorsPickPriority: 'joyful_celebration',
  },
  {
    id: 'rescue_last_chapter',
    label: 'The senior rescue I gave a last chapter to',
    defaultThemeBias: ['quiet_home', 'nap_champion', 'sunrise_reunion'],
    defaultStyleBias: ['watercolor', 'cinematic_realism'],
    narrationTone: 'gratitude_for_given_time',
    curatorsPickPriority: 'quiet_goodbye',
  },
  {
    id: 'always_mine',
    label: 'Always mine. From day one.',
    defaultThemeBias: ['beloved_places', 'quiet_home'],
    defaultStyleBias: ['cinematic_realism', 'watercolor'],
    narrationTone: 'lifelong_bond',
    curatorsPickPriority: 'classic_send_off',
  },
  {
    id: 'unspecified',
    label: "Other / I'd rather not say",
    defaultThemeBias: [],
    defaultStyleBias: [],
    narrationTone: 'neutral_warm',
    curatorsPickPriority: 'classic_send_off',
  },
] as const;

// ============================================================================
// MEMORY PROMPTS
// ============================================================================

export const memoryPrompts: readonly MemoryPrompt[] = [
  {
    id: 'sound_smell_feeling',
    label: 'A sound, smell, or feeling that brings [PET_NAME] back',
    placeholder: 'e.g. the click of his nails on the kitchen floor',
  },
  {
    id: 'would_not_believe',
    label: 'Something [PET_NAME] did that nobody else would believe',
    placeholder: 'e.g. she could open the back door by herself',
  },
  {
    id: 'most_want_to_remember',
    label: 'The thing you most want to remember',
    placeholder: 'e.g. how he greeted me at the door every single day',
  },
] as const;

// ============================================================================
// PERSONALITY TRAITS — upgraded from plain strings to full objects
// ============================================================================

export const personalityTraits: readonly PersonalityTrait[] = [
  {
    id: 'escape_artist',
    label: 'The escape artist',
    phrase: 'an escape artist who always found a way out',
    adjectiveTag: 'mischievous',
  },
  {
    id: 'greeter_at_door',
    label: 'The greeter at the door',
    phrase: 'the one who was always waiting at the door',
    adjectiveTag: 'loyal',
  },
  {
    id: 'shadow_at_feet',
    label: 'The shadow at my feet',
    phrase: 'my shadow, never more than a step away',
    adjectiveTag: 'cuddly',
  },
  {
    id: 'class_clown',
    label: 'The class clown',
    phrase: 'the one who made everyone laugh',
    adjectiveTag: 'goofy',
  },
  {
    id: 'protector',
    label: 'The protector',
    phrase: 'the brave one who always watched over us',
    adjectiveTag: 'brave',
  },
  {
    id: 'cuddle_thief',
    label: 'The cuddle thief',
    phrase: 'a relentless thief of laps and warm spots',
    adjectiveTag: 'cuddly',
  },
  {
    id: 'watchman',
    label: 'The watchman',
    phrase: 'the one who saw everything from the window',
    adjectiveTag: 'curious',
  },
  {
    id: 'wanderer',
    label: 'The wanderer',
    phrase: 'always exploring, always curious',
    adjectiveTag: 'curious',
  },
  {
    id: 'wise_old_soul',
    label: 'The wise old soul',
    phrase: 'an old soul, calm and knowing',
    adjectiveTag: 'gentle',
  },
  {
    id: 'eternal_puppy',
    label: 'The eternal puppy',
    phrase: 'forever young at heart',
    adjectiveTag: 'playful',
  },
] as const;

// ============================================================================
// FAVORITE THINGS — upgraded with sceneHint (feeds beat sheet generator)
// ============================================================================

export const favoriteThings: readonly FavoriteThing[] = [
  {
    id: 'naps_in_sunbeams',
    label: 'Naps in sunbeams',
    sceneHint: 'lying peacefully in a wide sunbeam on the floor or couch',
  },
  {
    id: 'window_watchman',
    label: 'Window-watchman duty',
    sceneHint: 'watching the world from a favorite window perch',
  },
  {
    id: 'four_pm_walk',
    label: 'The 4pm walk',
    sceneHint: 'on a familiar walking path at late-afternoon golden hour',
  },
  {
    id: 'car_rides',
    label: 'Car rides with the window down',
    sceneHint: 'head out the car window, ears flapping in the wind',
  },
  {
    id: 'favorite_toy',
    label: 'Their favorite toy',
    sceneHint: 'in a play-bow with their well-loved favorite toy',
  },
  {
    id: 'stealing_socks',
    label: 'Stealing socks',
    sceneHint: 'a stolen sock dangling from their mouth, mischievous eyes',
  },
  {
    id: 'mealtime_drama',
    label: 'Mealtime drama',
    sceneHint: 'alert and joyful at the food bowl, full attention',
  },
  {
    id: 'cuddles_on_couch',
    label: 'Cuddles on the couch',
    sceneHint: 'curled into a soft cuddle on the family couch',
  },
  {
    id: 'the_beach',
    label: 'The beach',
    sceneHint: 'running along wet sand at sunset, pawprints behind',
  },
  {
    id: 'snow_days',
    label: 'Snow days',
    sceneHint: 'bounding through fresh snow with pure joy',
  },
  {
    id: 'treats_hidden_anywhere',
    label: 'Treats hidden anywhere',
    sceneHint: 'alert, focused, the unmistakable look of a treat detected',
  },
  {
    id: 'backyard_patrol',
    label: 'The backyard patrol',
    sceneHint: 'doing the rounds of the backyard at golden hour',
  },
] as const;

// ============================================================================
// OPENING ARCHETYPES
// ============================================================================

export const openingArchetypes: readonly Archetype[] = [
  {
    id: 'simple',
    name: 'Simple',
    group: 'baseline',
    template: '[PET_NAME]',
    description: 'Just their name. The most minimal opening.',
  },
  {
    id: 'identity_good',
    name: 'A good [VOCATIVE_PLAIN], always',
    group: 'identity',
    template: '[PET_NAME]\nA good [VOCATIVE_PLAIN], always.',
  },
  {
    id: 'identity_our_trait',
    name: 'Our [TRAIT_ADJ] one',
    group: 'identity',
    template: '[PET_NAME]\nOur [TRAIT_ADJ] one.',
  },
  {
    id: 'joy_filled_days',
    name: '[PRONOUN_SUBJECT] filled every day with joy',
    group: 'joy',
    template: '[PET_NAME]\n[PRONOUN_SUBJECT_CAP] filled every day with joy.',
  },
  {
    id: 'joy_forever_trait',
    name: 'Forever [TRAIT_ADJ]',
    group: 'joy',
    template: '[PET_NAME]\nForever [TRAIT_ADJ].',
  },
  {
    id: 'love_beyond_measure',
    name: 'Loved beyond measure',
    group: 'love',
    template: '[PET_NAME]\nLoved beyond measure.',
  },
  {
    id: 'love_thank_you',
    name: 'Thank you for every good day',
    group: 'love',
    template: '[PET_NAME]\nThank you for every good day.',
  },
  {
    id: 'love_forever_in_hearts',
    name: 'Forever in our hearts',
    group: 'love',
    template: '[PET_NAME]\nForever in our hearts.',
  },
  {
    id: 'custom',
    name: 'Custom',
    group: 'custom',
    template: '[USER_INPUT_LINE_1]\n[USER_INPUT_LINE_2]',
    description: 'Write both lines yourself.',
  },
] as const;

// ============================================================================
// CLOSING ARCHETYPES
// ============================================================================

export const closingArchetypes: readonly Archetype[] = [
  {
    id: 'peace_sleep_well',
    name: 'Sleep well, sweet [VOCATIVE_PLAIN]',
    group: 'peace',
    template: 'Sleep well, sweet [VOCATIVE_PLAIN].',
  },
  {
    id: 'peace_resting_now',
    name: 'Resting now',
    group: 'peace',
    template: 'Resting now.',
  },
  {
    id: 'bond_best_friend',
    name: 'My best friend',
    group: 'bond',
    template: 'My best friend.',
  },
  {
    id: 'bond_the_best',
    name: 'The best [VOCATIVE_PLAIN]',
    group: 'bond',
    template: 'The best [VOCATIVE_PLAIN].',
  },
  {
    id: 'reunion_until_we_meet',
    name: 'Until we meet again, [PET_NAME]',
    group: 'reunion',
    template: 'Until we meet again, [PET_NAME].',
  },
  {
    id: 'reunion_wait_at_door',
    name: 'Wait for us at the door, [VOCATIVE_GOOD]',
    group: 'reunion',
    template: 'Wait for us at the door, [VOCATIVE_GOOD].',
  },
  {
    id: 'gratitude_thank_you',
    name: 'Thank you for every good day',
    group: 'gratitude',
    template: 'Thank you for every good day.',
  },
  {
    id: 'gratitude_simple_farewell',
    name: 'Forever loved · [PET_NAME]',
    group: 'gratitude',
    template: 'Forever loved · [PET_NAME].',
    isDefault: true,
  },
  {
    id: 'custom',
    name: 'Custom',
    group: 'custom',
    template: '[USER_INPUT]',
    description: 'Write it yourself.',
  },
] as const;

// ============================================================================
// CAPTION TEMPLATES
// ============================================================================

export const captionTemplates: Record<string, string[]> = {
  sunbeam: [
    '[PRONOUN_POSSESSIVE_CAP] favorite spot.',
    '[PRONOUN_SUBJECT_CAP] loved the morning light.',
    'This is where [PRONOUN_SUBJECT] was happiest.',
  ],
  favorite_toy: [
    '[PRONOUN_SUBJECT_CAP] never let it go.',
    '[PRONOUN_POSSESSIVE_CAP] favorite thing in the world.',
    'Always ready to play.',
  ],
  car_ride: [
    'Wind in [PRONOUN_POSSESSIVE] ears. Pure joy.',
    'Every car ride, the best day.',
    'Going anywhere with us was enough.',
  ],
  quiet_pause: [
    'Always watching over us.',
    'Right where [PRONOUN_SUBJECT] belonged.',
    'Our quiet shadow.',
  ],
  familiar_gaze: [
    'That look. Every day.',
    "I'll never forget those eyes.",
    '[PRONOUN_SUBJECT_CAP] saw all of me.',
  ],
  threshold: [
    '[PRONOUN_SUBJECT_CAP] was ready.',
    '[PRONOUN_SUBJECT_CAP] knew the way.',
    'Toward the light.',
  ],
  glance_back: [
    "[PRONOUN_SUBJECT_CAP]'s saying it's okay.",
    'One last look. Always.',
    'Goodbye, [VOCATIVE].',
  ],
  joyful_release: ['Running again, finally.', 'Free.', 'Forever young.'],
  custom: [],
} as const;

// ============================================================================
// MUSIC TRACKS — 9 named tracks + silence
// ============================================================================

export const musicTracks: readonly MusicTrack[] = [
  {
    id: 'soft_piano_01',
    name: 'Soft Piano',
    description: 'Solo piano, gentle, contemplative.',
    durationS: 200,
    mood: 'intimate',
    pairsWith: ['home_and_everyday_love', 'healing_and_peace', 'quiet_grief'],
    styleMatch: ['watercolor', 'cinematic_realism', 'storybook_illustration'],
  },
  {
    id: 'warm_cello_piano_01',
    name: 'Warm Cello & Piano',
    description: 'Duet of warm cello and piano, gentle build.',
    durationS: 210,
    mood: 'hopeful',
    pairsWith: ['healing_and_peace', 'home_and_everyday_love', 'spiritual_and_symbolic'],
    styleMatch: ['cinematic_realism', 'watercolor'],
  },
  {
    id: 'acoustic_guitar_01',
    name: 'Acoustic Guitar',
    description: 'Fingerpicked acoustic guitar, folk warmth.',
    durationS: 195,
    mood: 'warm',
    pairsWith: ['home_and_everyday_love', 'their_personality', 'nature_and_freedom'],
    styleMatch: ['cinematic_realism', 'storybook_illustration'],
  },
  {
    id: 'ambient_strings_01',
    name: 'Ambient Strings',
    description: 'Slow ambient strings, no melody, atmospheric.',
    durationS: 220,
    mood: 'reflective',
    pairsWith: ['quiet_grief', 'spiritual_and_symbolic', 'healing_and_peace'],
    styleMatch: ['watercolor', 'cinematic_realism'],
  },
  {
    id: 'light_strings_01',
    name: 'Light Strings',
    description: 'Gently rising string quartet, hopeful arc.',
    durationS: 200,
    mood: 'hopeful',
    pairsWith: ['healing_and_peace', 'their_personality', 'nature_and_freedom'],
    styleMatch: ['cinematic_realism', 'storybook_illustration'],
  },
  {
    id: 'music_box_01',
    name: 'Music Box',
    description: 'Soft music-box melody, childhood nostalgia.',
    durationS: 180,
    mood: 'tender',
    pairsWith: ['their_personality', 'home_and_everyday_love'],
    styleMatch: ['storybook_illustration', 'watercolor'],
  },
  {
    id: 'piano_strings_warm_01',
    name: 'Piano with Soft Strings',
    description: 'Piano lead, strings supporting, warm ensemble.',
    durationS: 210,
    mood: 'cinematic_warm',
    pairsWith: ['healing_and_peace', 'nature_and_freedom', 'spiritual_and_symbolic'],
    styleMatch: ['cinematic_realism'],
  },
  {
    id: 'ambient_pads_01',
    name: 'Ambient Pads',
    description: 'Soft synth pads, no rhythm, dream-like.',
    durationS: 220,
    mood: 'ethereal',
    pairsWith: ['spiritual_and_symbolic', 'healing_and_peace', 'quiet_grief'],
    styleMatch: ['watercolor', 'cinematic_realism'],
  },
  {
    id: 'bittersweet',
    name: 'Bittersweet',
    description: 'Soft piano and cello, a tender ache beneath the warmth.',
    durationS: 205,
    mood: 'bittersweet',
    pairsWith: ['healing_and_peace', 'quiet_grief', 'home_and_everyday_love'],
    styleMatch: ['watercolor', 'cinematic_realism', 'storybook_illustration'],
  },
  {
    id: 'quiet_contemplative',
    name: 'Quiet Contemplative',
    description: 'Sparse piano with long pauses, still and reflective.',
    durationS: 210,
    mood: 'contemplative',
    pairsWith: ['home_and_everyday_love', 'quiet_grief', 'healing_and_peace'],
    styleMatch: ['cinematic_realism', 'watercolor'],
  },
  {
    id: 'silence',
    name: 'Silence (ambient sound only)',
    description: 'No music — the in-clip ambient audio carries the tribute.',
    durationS: 0,
    mood: 'pure',
    pairsWith: [
      'healing_and_peace',
      'quiet_grief',
      'home_and_everyday_love',
      'nature_and_freedom',
      'their_personality',
      'spiritual_and_symbolic',
    ],
    styleMatch: [
      'cinematic_realism',
      'watercolor',
      'storybook_illustration',
      'animated_3d',
      'claymation',
      'pencil_sketch',
      'pixel_art',
      'voxel_minecraft',
    ],
  },
] as const;

// ============================================================================
// NARRATION VOICES
// ============================================================================

export const narrationVoices: readonly NarrationVoice[] = [
  {
    id: 'warm_female_alto',
    name: 'Warm female alto',
    description: 'Soft, intimate, slightly breathy. Best for tender letter delivery.',
    defaultFor: ['watercolor', 'storybook_illustration'],
  },
  {
    id: 'warm_male_baritone',
    name: 'Warm male baritone',
    description: 'Gentle, steady, lower register. Best for ceremonial tributes.',
    defaultFor: ['cinematic_realism'],
  },
  {
    id: 'soft_female_mezzo',
    name: 'Soft female mezzo',
    description: 'Mid-register warmth, conversational.',
    defaultFor: [],
  },
  {
    id: 'user_recorded',
    name: 'My own voice',
    description: 'User records and uploads their own narration audio.',
    defaultFor: [],
  },
] as const;

// ============================================================================
// PRONOUNS AND VOCATIVES
// ============================================================================

export const pronounsAndVocatives: Record<Gender, PronounSet> = {
  male: {
    pronounSubject: 'he',
    pronounObject: 'him',
    pronounPossessive: 'his',
    pronounReflexive: 'himself',
    vocativePlain: 'boy',
    vocative: 'sweet boy',
    vocativeBuddy: 'buddy',
    vocativeGood: 'good boy',
    vocativeDear: 'dear boy',
  },
  female: {
    pronounSubject: 'she',
    pronounObject: 'her',
    pronounPossessive: 'her',
    pronounReflexive: 'herself',
    vocativePlain: 'girl',
    vocative: 'sweet girl',
    vocativeBuddy: 'sweetheart',
    vocativeGood: 'good girl',
    vocativeDear: 'dear girl',
  },
  neutral: {
    pronounSubject: 'they',
    pronounObject: 'them',
    pronounPossessive: 'their',
    pronounReflexive: 'themself',
    vocativePlain: 'one',
    vocative: 'sweet one',
    vocativeBuddy: 'dear friend',
    vocativeGood: 'good one',
    vocativeDear: 'dear one',
  },
} as const;

// ============================================================================
// LENGTHS AND ASPECTS — verbatim from LENGTHS / ASPECTS in page.tsx
// ============================================================================

export const lengths: readonly LengthOption[] = [
  { id: 2, name: '2 minutes', subtitle: '8 beats · short & sweet', beatCount: 8, targetMinutes: 2 },
  { id: 3, name: '3 minutes', subtitle: '12 beats · recommended', beatCount: 12, targetMinutes: 3 },
  { id: 4, name: '4 minutes', subtitle: '16 beats · full chapter', beatCount: 16, targetMinutes: 4 },
] as const;

export const aspects: readonly AspectOption[] = [
  { id: '9:16', name: 'Vertical', subtitle: 'phone-first', ratio: '9 / 16' },
  { id: '16:9', name: 'Horizontal', subtitle: 'TV & family viewing', ratio: '16 / 9' },
  { id: '1:1', name: 'Square', subtitle: 'social feeds', ratio: '1 / 1' },
  { id: 'all_three', name: 'All Three', subtitle: 'all formats', ratio: '9 / 16' },
] as const;

// ============================================================================
// BEAT STRUCTURES — arc templates from skill Stage 2.5 / Stage 4
// ============================================================================

export const beatStructures: Record<8 | 12 | 16, BeatArchetype[]> = {
  8: ['open', 'memory', 'memory', 'connection', 'ceremonial', 'ceremonial', 'release', 'close'],
  12: [
    'open',
    'memory',
    'memory',
    'memory',
    'memory',
    'connection',
    'ceremonial',
    'ceremonial',
    'ceremonial',
    'release',
    'release',
    'close',
  ],
  16: [
    'open',
    'memory',
    'memory',
    'memory',
    'memory',
    'memory',
    'connection',
    'connection',
    'ceremonial',
    'ceremonial',
    'ceremonial',
    'ceremonial',
    'release',
    'release',
    'release',
    'close',
  ],
} as const;

// ============================================================================
// CINEMATOGRAPHY ENGINE SCHEMA (Section 6.1)
// ============================================================================

export const cinematographyEngine: CinematographyEngineSchema = {
  visionInputs: {
    subjectEnergy: ['still', 'low', 'medium', 'high'],
    subjectPose: ['lying', 'sitting', 'standing', 'walking', 'running', 'mid_leap', 'closed_eyes'],
    framing: ['extreme_close', 'close', 'medium', 'wide', 'extreme_wide'],
    environmentalMotion: ['still', 'wind', 'water', 'particles', 'sky', 'dappled_light'],
    depthLayers: ['1', '2', '3+'],
    dominantPaletteTemperature: ['warm', 'neutral', 'cool'],
  },
  derivationFields: [
    {
      field: 'lens_mm',
      values: [24, 35, 50, 85, 105],
      sourcedFrom: 'framing × emotional_register × tribute lens-range constraint',
    },
    {
      field: 'lens_character',
      values: ['wide_establishing', 'standard', 'portrait', 'compression'],
      sourcedFrom: 'derived from lens_mm',
    },
    {
      field: 'camera_move',
      values: [
        'locked_off',
        'slow_push',
        'slow_pull',
        'slow_rise',
        'slow_fall',
        'slow_pan_L',
        'slow_pan_R',
        'slow_orbit',
        'parallax_dolly',
        'handheld_float',
        'dreamy_drift',
      ],
      sourcedFrom: 'subject_energy × beat_archetype × prior-scene move (variety constraint)',
    },
    {
      field: 'move_intensity',
      values: ['barely_perceptible', 'gentle', 'pronounced'],
      sourcedFrom: 'caption_word_count + subject_energy + emotional_register',
    },
    {
      field: 'subject_motion',
      values: ['locked', 'breath_only', 'loop_idle', 'loop_action', 'one_shot_action'],
      sourcedFrom: 'subject_pose × beat_archetype',
    },
    {
      field: 'lighting_motion',
      values: [
        'static',
        'drifting_sunbeam',
        'leaf_dapple_breeze',
        'candle_flicker',
        'dust_motes',
        'rim_light_pulse',
      ],
      sourcedFrom: 'environmental_motion × time_of_day_implied',
    },
    {
      field: 'dof_behavior',
      values: [
        'locked_shallow',
        'locked_deep',
        'rack_to_subject',
        'rack_to_environment',
        'rack_to_caption',
      ],
      sourcedFrom: 'beat_archetype × caption_word_count',
    },
    {
      field: 'shot_structure',
      values: ['single_sustained', 'two_shot_cut', 'three_shot_montage'],
      sourcedFrom: 'subject_energy × format',
      default: 'single_sustained',
      notes:
        'single_sustained is default; multi-shot only on high-energy beats in non-ceremonial formats.',
    },
    {
      field: 'ambient_audio',
      values: ['birdsong', 'wind_grass', 'hearth_crackle', 'soft_rain', 'water_lapping', 'silence', 'breath_only'],
      sourcedFrom: 'environment + theme + emotional_register',
    },
    {
      field: 'audio_intensity',
      values: ['bed_only', 'present', 'forward'],
      sourcedFrom: 'emotional_register × position_in_arc',
    },
  ],
  consistencyConstraints: [
    {
      id: 'lens_range',
      rule: 'The tribute may use at most 2 of {24, 35, 50, 85, 105}. If a brief proposes a lens outside the allowed range, reassign it to the nearest in-range lens with the same lens_character.',
      defaultRangesByFormat: {
        day_in_the_life: [35, 85],
        send_off: [50, 85],
        music_video: [35, 50, 85],
        letter: [50, 85],
        postcards: [24, 50],
      },
    },
    {
      id: 'move_direction_variety',
      rule: 'No more than 3 consecutive beats may share the same camera_move. If violated, the third (offending) scene is re-derived from its second-best move option.',
      maxConsecutive: 3,
    },
    {
      id: 'calm_bookends',
      rule: 'Beat 1 (opening) and the final beat (closing) MUST have move_intensity ≤ gentle and shot_structure = single_sustained. Sets the emotional frame.',
    },
    {
      id: 'caption_readable',
      rule: 'Any beat with caption_word_count ≥ 12 is forced to move_intensity = barely_perceptible regardless of subject_energy.',
      captionWordThreshold: 12,
    },
    {
      id: 'ambient_continuity',
      rule: 'Across the tribute, the ambient_audio palette must use no more than 3 sound families to avoid sonic whiplash between scenes.',
      maxSoundFamilies: 3,
    },
  ],
} as const;

// ============================================================================
// DP STYLE LIBRARY (Section 6.4)
// ============================================================================

export const dpStyleLibrary: readonly DpStyle[] = [
  {
    id: 'none',
    name: 'None',
    bias: 'No bias; rules-only derivation.',
  },
  {
    id: 'deakins_minimalist',
    name: 'Deakins minimalist',
    bias: 'Prefer 50mm, locked_off + gentle pushes, deep focus, single_sustained shots, static lighting.',
  },
  {
    id: 'lubezki_natural',
    name: 'Lubezki natural',
    bias: 'Prefer 35mm, handheld_float + parallax_dolly, golden-hour bias, drifting_sunbeam + leaf_dapple_breeze lighting.',
  },
  {
    id: 'young_intimate',
    name: 'Young intimate',
    bias: 'Prefer 85mm + 105mm, slow_push + locked_off, shallow rack_to_subject, candle_flicker / rim_light_pulse.',
  },
  {
    id: 'khondji_painterly',
    name: 'Khondji painterly',
    bias: 'Prefer 50mm + 85mm, dreamy_drift + slow_orbit, deep palette compression, dust_motes + drifting_sunbeam.',
  },
  {
    id: 'wong_kar_wai_dreamy',
    name: 'Wong Kar-wai dreamy',
    bias: 'Prefer 35mm + 50mm, slight slow-motion subject_motion, rack_to_environment frequently, candle_flicker / dreamy_drift.',
  },
] as const;
