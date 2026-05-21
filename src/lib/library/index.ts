import { ART_STYLES } from './art-styles';
import { COPY } from './copy';
import { CURATORS_PICKS } from './curators-picks';
import { DEFAULTS } from './defaults';
import { FAVORITE_THINGS, MEMORY_PROMPTS, PERSONALITY_TRAITS } from './intake';
import { FORMATS } from './formats';
import { GENDER_OPTIONS, PRONOUNS_AND_VOCATIVES } from './pronouns';
import { RELATIONSHIPS } from './relationships';
import { THEMES, THEME_CATEGORIES } from './themes';
import { PET_PROFILE_SCHEMA, VISION_PASS_PROMPT } from './vision-pass';

export {
  ART_STYLES,
  COPY,
  CURATORS_PICKS,
  DEFAULTS,
  FAVORITE_THINGS,
  FORMATS,
  GENDER_OPTIONS,
  MEMORY_PROMPTS,
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
