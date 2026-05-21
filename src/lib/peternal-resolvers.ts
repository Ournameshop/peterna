import type {
  Gender,
  FormatId,
  RelationshipId,
  ThemeCategoryId,
  ArtStyleId,
  ThemeId,
  Archetype,
  CuratorPick,
  CuratorPickId,
  MusicTrack,
} from '@/lib/peternal-library';
import {
  pronounsAndVocatives,
  relationships,
  curatorsPicks,
  themes,
  musicTracks,
} from '@/lib/peternal-library';

type ResolveCtx = {
  gender: Gender;
  petName: string;
  traitAdj?: string;
  userInput?: string[];
};

// Pronoun & vocative resolution from pronounsAndVocatives table.
// Handles all 16 placeholder tokens defined in blueprint Section 2.4.
export function resolveText(template: string, ctx: ResolveCtx): string {
  const p = pronounsAndVocatives[ctx.gender];
  const subjectCap = p.pronounSubject.charAt(0).toUpperCase() + p.pronounSubject.slice(1);
  const possessiveCap = p.pronounPossessive.charAt(0).toUpperCase() + p.pronounPossessive.slice(1);

  let result = template;
  result = result.replace(/\[PRONOUN_SUBJECT_CAP\]/g, subjectCap);
  result = result.replace(/\[PRONOUN_SUBJECT\]/g, p.pronounSubject);
  result = result.replace(/\[PRONOUN_OBJECT\]/g, p.pronounObject);
  result = result.replace(/\[PRONOUN_POSSESSIVE_CAP\]/g, possessiveCap);
  result = result.replace(/\[PRONOUN_POSSESSIVE\]/g, p.pronounPossessive);
  result = result.replace(/\[PRONOUN_REFLEXIVE\]/g, p.pronounReflexive);
  result = result.replace(/\[VOCATIVE_PLAIN\]/g, p.vocativePlain);
  result = result.replace(/\[VOCATIVE_GOOD\]/g, p.vocativeGood);
  result = result.replace(/\[VOCATIVE_DEAR\]/g, p.vocativeDear);
  result = result.replace(/\[VOCATIVE_BUDDY\]/g, p.vocativeBuddy);
  result = result.replace(/\[VOCATIVE\]/g, p.vocative);
  result = result.replace(/\[PET_NAME\]/g, ctx.petName);
  result = result.replace(/\[TRAIT_ADJ\]/g, ctx.traitAdj ?? '');
  if (ctx.userInput) {
    result = result.replace(/\[USER_INPUT_LINE_1\]/g, ctx.userInput[0] ?? '');
    result = result.replace(/\[USER_INPUT_LINE_2\]/g, ctx.userInput[1] ?? '');
    result = result.replace(/\[USER_INPUT\]/g, ctx.userInput[0] ?? '');
  }
  return result;
}

// Convenience wrapper: resolve an archetype's template to its on-screen text.
export function resolveArchetype(a: Archetype, ctx: ResolveCtx): string {
  return resolveText(a.template, ctx);
}

// Curator's-pick reordering by relationship (skill Stage 3.1).
// Moves the relationship's curatorsPickPriority pick to index 0; rest keep library order.
export function orderCuratorsPicks(relationship: RelationshipId): {
  ordered: readonly CuratorPick[];
  highlightedId: CuratorPickId | null;
} {
  if (relationship === 'unspecified') {
    return { ordered: curatorsPicks, highlightedId: null };
  }
  const rel = relationships.find((r) => r.id === relationship);
  if (!rel || !rel.curatorsPickPriority) {
    return { ordered: curatorsPicks, highlightedId: null };
  }
  const priorityId = rel.curatorsPickPriority as CuratorPickId;
  const matched = curatorsPicks.find((p) => p.id === priorityId);
  if (!matched) {
    return { ordered: curatorsPicks, highlightedId: null };
  }
  const rest = curatorsPicks.filter((p) => p.id !== priorityId);
  return {
    ordered: [matched, ...rest] as readonly CuratorPick[],
    highlightedId: priorityId,
  };
}

// Relationship-driven silent defaults for the manual path (Stage 3.1 last paragraph).
export function defaultThemeCategoryFor(relationship: RelationshipId): ThemeCategoryId | null {
  const rel = relationships.find((r) => r.id === relationship);
  if (!rel || !rel.defaultThemeBias || rel.defaultThemeBias.length === 0) return null;
  // First bias theme → look up its category
  const firstThemeId = rel.defaultThemeBias[0] as ThemeId;
  const theme = themes.find((t) => t.id === firstThemeId);
  return theme ? (theme.category as ThemeCategoryId) : null;
}

export function defaultStyleFor(relationship: RelationshipId): ArtStyleId | null {
  const rel = relationships.find((r) => r.id === relationship);
  if (!rel || !rel.defaultStyleBias || rel.defaultStyleBias.length === 0) return null;
  return rel.defaultStyleBias[0] as ArtStyleId;
}

// Caption-voice pairing matrix (SKILL lines 243–252). Returns a label + a tense hint.
const CAPTION_VOICE_MAP: Record<FormatId, { label: string; tenseHint: string }> = {
  day_in_the_life: {
    label: 'Storybook narrator, gentle past tense',
    tenseHint: 'gentle past tense ("The morning light woke her gently.")',
  },
  biopic: {
    label: 'Storybook narrator, life-stage past tense',
    tenseHint: 'life-stage past tense ("She was young then, and the world was new.")',
  },
  letter: {
    label: 'First-person from owner to pet',
    tenseHint: 'present-feeling ("You always loved the mornings most.")',
  },
  forever_young: {
    label: 'Present-tense narrator',
    tenseHint: 'present tense ("She is running through the field. She is always running.")',
  },
  send_off: {
    label: 'Reverent past tense, restrained',
    tenseHint: 'reverent past tense ("It was time. She walked toward the light, unafraid.")',
  },
  postcards: {
    label: 'First-person from the pet',
    tenseHint: 'first-person from pet ("Found a meadow today. Wish you were here.")',
  },
  greatest_hits: {
    label: 'Storybook narrator, celebratory',
    tenseHint: 'celebratory ("Then there was the time she stole the whole steak.")',
  },
  music_video: {
    label: 'Captions optional; lyric-fragment style',
    tenseHint: 'lyric-fragment style if used',
  },
};

export function captionVoiceFor(format: FormatId): { label: string; tenseHint: string } {
  return CAPTION_VOICE_MAP[format];
}

// Music filtering for Stage 5.5.4 — tracks whose pairsWith includes the theme's category
// AND styleMatch includes the chosen style; always return >= 4 (pad with mood-nearest).
export function musicTracksFor(theme: ThemeId, style: ArtStyleId): MusicTrack[] {
  const themeObj = themes.find((t) => t.id === theme);
  const category = themeObj ? themeObj.category : null;

  const primary = musicTracks.filter((track) => {
    const categoryMatch =
      category &&
      Array.isArray(track.pairsWith) &&
      (track.pairsWith.includes(category) || track.pairsWith.includes('all' as never));
    const styleMatch =
      Array.isArray(track.styleMatch) &&
      (track.styleMatch.includes(style) || track.styleMatch.includes('all' as never));
    return categoryMatch && styleMatch;
  });

  if (primary.length >= 4) return primary;

  // Pad with mood-nearest: tracks matching category OR style, not already included
  const secondary = musicTracks.filter((track) => {
    if (primary.includes(track)) return false;
    const categoryMatch =
      category &&
      Array.isArray(track.pairsWith) &&
      (track.pairsWith.includes(category) || track.pairsWith.includes('all' as never));
    const styleMatch =
      Array.isArray(track.styleMatch) &&
      (track.styleMatch.includes(style) || track.styleMatch.includes('all' as never));
    return categoryMatch || styleMatch;
  });

  const combined = [...primary, ...secondary];
  if (combined.length >= 4) return combined.slice(0, 4);

  // Last resort: fill with any remaining tracks in library order
  const fallback = musicTracks.filter((t) => !combined.includes(t));
  return [...combined, ...fallback].slice(0, 4);
}
