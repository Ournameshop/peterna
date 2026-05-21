// Relationships table — transcribed verbatim from the spec's embedded
// library YAML (SKILL v2.3, §EMBEDDED ASSET LIBRARY).
//
// Stage 1.8 captures the relationship. It is the single biggest emotional
// differentiator in the intake — it drives Curator's Pick reorder, theme/style
// biases for the manual path, narration tone, and eulogy voice.

export type RelationshipId =
  | 'childhood'
  | 'partnership'
  | 'companion_through_grief'
  | 'family_first'
  | 'rescue_last_chapter'
  | 'always_mine'
  | 'unspecified';

export type Relationship = {
  readonly id: RelationshipId;
  readonly label: string;
  readonly default_theme_bias: readonly string[];
  readonly default_style_bias: readonly string[];
  readonly narration_tone: string;
  readonly curators_pick_priority: string;
};

export const RELATIONSHIPS: ReadonlyArray<Relationship> = [
  {
    id: 'childhood',
    label: 'The childhood pet I grew up with',
    default_theme_bias: ['beloved_places', 'golden_meadow'],
    default_style_bias: ['storybook_illustration', 'watercolor'],
    narration_tone: 'nostalgic',
    curators_pick_priority: 'storybook_for_them',
  },
  {
    id: 'partnership',
    label: 'The pet we adopted together',
    default_theme_bias: ['quiet_home', 'beloved_places'],
    default_style_bias: ['cinematic_realism', 'watercolor'],
    narration_tone: 'shared_love',
    curators_pick_priority: 'quiet_goodbye',
  },
  {
    id: 'companion_through_grief',
    label: 'The pet who got me through a hard time',
    default_theme_bias: ['quiet_home', 'gentle_rain', 'moonlight_vigil'],
    default_style_bias: ['watercolor'],
    narration_tone: 'gratitude_deep',
    curators_pick_priority: 'quiet_goodbye',
  },
  {
    id: 'family_first',
    label: "My family's first pet — for my kids",
    default_theme_bias: ['forever_playful', 'golden_meadow', 'beloved_places'],
    default_style_bias: ['storybook_illustration'],
    narration_tone: 'warm_familial',
    curators_pick_priority: 'joyful_celebration',
  },
  {
    id: 'rescue_last_chapter',
    label: 'The senior rescue I gave a last chapter to',
    default_theme_bias: ['quiet_home', 'nap_champion', 'sunrise_reunion'],
    default_style_bias: ['watercolor', 'cinematic_realism'],
    narration_tone: 'gratitude_for_given_time',
    curators_pick_priority: 'quiet_goodbye',
  },
  {
    id: 'always_mine',
    label: 'Always mine. From day one.',
    default_theme_bias: ['beloved_places', 'quiet_home'],
    default_style_bias: ['cinematic_realism', 'watercolor'],
    narration_tone: 'lifelong_bond',
    curators_pick_priority: 'classic_send_off',
  },
  {
    id: 'unspecified',
    label: "Other / I'd rather not say",
    default_theme_bias: [],
    default_style_bias: [],
    narration_tone: 'neutral_warm',
    curators_pick_priority: 'classic_send_off',
  },
] as const;
