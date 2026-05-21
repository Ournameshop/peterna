import { ART_STYLES } from './art-styles';
import { CLOSING_ARCHETYPES } from './closing-archetypes';
import { COPY } from './copy';
import { CURATORS_PICKS } from './curators-picks';
import { DEFAULTS, DEFAULT_WORDS } from './defaults';
import { FAVORITE_THINGS, MEMORY_PROMPTS, PERSONALITY_TRAITS } from './intake';
import { FORMATS } from './formats';
import { MUSIC_TRACKS } from './music-tracks';
import { NARRATION_VOICES } from './narration-voices';
import { OPENING_ARCHETYPES } from './opening-archetypes';
import { GENDER_OPTIONS, PRONOUNS_AND_VOCATIVES } from './pronouns';
import { RELATIONSHIPS } from './relationships';
import { THEMES, THEME_CATEGORIES } from './themes';
import { PET_PROFILE_SCHEMA, VISION_PASS_PROMPT } from './vision-pass';

export {
  ART_STYLES,
  CLOSING_ARCHETYPES,
  COPY,
  CURATORS_PICKS,
  DEFAULTS,
  DEFAULT_WORDS,
  FAVORITE_THINGS,
  FORMATS,
  GENDER_OPTIONS,
  MEMORY_PROMPTS,
  MUSIC_TRACKS,
  NARRATION_VOICES,
  OPENING_ARCHETYPES,
  PERSONALITY_TRAITS,
  PET_PROFILE_SCHEMA,
  PRONOUNS_AND_VOCATIVES,
  RELATIONSHIPS,
  THEMES,
  THEME_CATEGORIES,
  VISION_PASS_PROMPT,
};

// Load-time validator: per the Stage 0 rule in data-model.md, fail loudly if any required
// library list is below its minimum count. Set SKIP_LIBRARY_VALIDATION=1 during scaffolding
// (Phase 0) — stubs are empty by design and would otherwise refuse to load.

type Check = { name: string; ok: boolean; detail: string };

function checkMinimums(): Check[] {
  const pronounKeys = Object.keys(PRONOUNS_AND_VOCATIVES);
  return [
    {
      name: 'formats',
      ok: FORMATS.length >= 8,
      detail: `expected >=8, got ${FORMATS.length}`,
    },
    {
      name: 'themes',
      ok: THEMES.length >= 12,
      detail: `expected >=12, got ${THEMES.length}`,
    },
    {
      name: 'art_styles',
      ok: ART_STYLES.length >= 8,
      detail: `expected >=8, got ${ART_STYLES.length}`,
    },
    {
      name: 'pronouns_and_vocatives',
      ok: pronounKeys.length >= 3,
      detail: `expected >=3 keys, got ${pronounKeys.length}`,
    },
    {
      name: 'theme_categories',
      ok: THEME_CATEGORIES.length === 6,
      detail: `expected exactly 6, got ${THEME_CATEGORIES.length}`,
    },
    {
      name: 'curators_picks',
      ok: CURATORS_PICKS.length >= 4,
      detail: `expected >=4, got ${CURATORS_PICKS.length}`,
    },
    // Phase 5 — Stage 5.5 / 5.6 library minimums (spec line 311-316).
    {
      name: 'opening_archetypes',
      ok: OPENING_ARCHETYPES.length >= 7,
      detail: `expected >=7, got ${OPENING_ARCHETYPES.length}`,
    },
    {
      name: 'closing_archetypes',
      ok: CLOSING_ARCHETYPES.length >= 7,
      detail: `expected >=7, got ${CLOSING_ARCHETYPES.length}`,
    },
    {
      name: 'music_tracks',
      ok: MUSIC_TRACKS.length >= 8,
      detail: `expected >=8, got ${MUSIC_TRACKS.length}`,
    },
    {
      name: 'narration_voices',
      ok: NARRATION_VOICES.length >= 3,
      detail: `expected >=3, got ${NARRATION_VOICES.length}`,
    },
  ];
}

function runValidator(): void {
  const failures = checkMinimums().filter((c) => !c.ok);
  if (failures.length === 0) return;

  const summary = failures.map((f) => `  - ${f.name}: ${f.detail}`).join('\n');
  const message = `Library content failed minimum-count validation:\n${summary}`;

  if (process.env.SKIP_LIBRARY_VALIDATION === '1') {
    console.warn(`[library] ${message}\n[library] SKIP_LIBRARY_VALIDATION=1 set — continuing.`);
    return;
  }

  throw new Error(message);
}

runValidator();
