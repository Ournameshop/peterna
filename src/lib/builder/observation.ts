// Composes Stage 1.5's warm "observation paragraph" from the vision-pass
// output. Tone rules from spec §1.5 (HARD):
//
//   - "Looks like" / "I see" — never "is" or "must be"
//   - High confidence = statements; medium = hedged; low = omitted
//   - 2–3 fields max per sentence
//   - Never project emotional state ("happy", "sad")
//
// This file is client-safe (no server-only imports) so the confirmation card
// can rebuild the paragraph after the user edits a chip without round-tripping
// to the backend.

import type { InferredProfile } from './state';

const SPECIES_LABELS: Record<string, string> = {
  dog: 'dog',
  cat: 'cat',
  rabbit: 'rabbit',
  bird: 'bird',
  hamster: 'hamster',
  guinea_pig: 'guinea pig',
  ferret: 'ferret',
  reptile: 'reptile',
  fish: 'fish',
  horse: 'horse',
  other: 'companion',
};

const AGE_LABELS: Record<string, string> = {
  puppy_kitten: 'puppy',
  young_adult: 'young adult',
  adult: 'adult',
  senior: 'senior',
};

const AGE_LABELS_CAT: Record<string, string> = {
  puppy_kitten: 'kitten',
  young_adult: 'young adult',
  adult: 'adult',
  senior: 'senior',
};

function hasContent(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function speciesPhrase(profile: InferredProfile): string | null {
  if (!hasContent(profile.species)) return null;
  const sp = SPECIES_LABELS[profile.species] ?? profile.species;
  return sp;
}

function ageLabel(profile: InferredProfile): string | null {
  if (!profile.age_range) return null;
  const table = profile.species === 'cat' ? AGE_LABELS_CAT : AGE_LABELS;
  return table[profile.age_range] ?? null;
}

/**
 * Build the Stage 1.5 observation paragraph. Returns `null` when there's
 * nothing useful to say — the caller should render the vision-failure
 * fallback in that case.
 */
export function composeObservationParagraph(
  profile: InferredProfile | null | undefined,
  petName: string | null | undefined,
): string | null {
  if (!profile || profile.vision_failure) return null;

  const name = hasContent(petName) ? petName : 'Your pet';
  const sp = speciesPhrase(profile);
  const breed = hasContent(profile.breed_guess) ? profile.breed_guess.trim() : null;
  const coat = hasContent(profile.coat_description)
    ? profile.coat_description.trim()
    : null;
  const age = ageLabel(profile);

  // Lead sentence: species + breed + coat, hedged by confidence.
  // High-confidence species/breed → "Spike looks like a <coat> <breed>"
  // (we always use "looks like" per the tone rules — even high-confidence
  // fields are observations, not assertions; the spec wants softness.)
  const leadParts: string[] = [];

  // breed phrase incorporates coat when both are present and high/medium conf
  if (breed && coat && (profile.breed_confidence ?? 'low') !== 'low') {
    leadParts.push(`a ${coat.toLowerCase()} ${breed.toLowerCase()}`);
  } else if (breed && (profile.breed_confidence ?? 'low') !== 'low') {
    leadParts.push(`a ${breed.toLowerCase()}`);
  } else if (sp && coat && (profile.coat_confidence ?? 'low') !== 'low') {
    leadParts.push(`a ${coat.toLowerCase()} ${sp}`);
  } else if (sp) {
    leadParts.push(`a ${sp}`);
  }

  if (leadParts.length === 0) return null;

  let paragraph = `${name} looks like ${leadParts.join('')}`;

  // Tail clause: age + observed_moment/setting, hedged or omitted.
  const tailParts: string[] = [];
  if (age && (profile.age_confidence ?? 'low') !== 'low') {
    // Use the indefinite article appropriately
    const article = /^[aeiou]/i.test(age) ? 'an' : 'a';
    tailParts.push(`${article} ${age}`);
  }

  if (
    hasContent(profile.observed_moment) &&
    (profile.moment_confidence ?? 'low') !== 'low'
  ) {
    tailParts.push(profile.observed_moment.trim().toLowerCase());
  } else if (
    hasContent(profile.observed_setting) &&
    (profile.setting_confidence ?? 'low') !== 'low'
  ) {
    const setting = profile.observed_setting.trim().toLowerCase();
    // Soften with "in one of your photos" cue.
    tailParts.push(`in ${setting}`);
  }

  if (tailParts.length > 0) {
    paragraph += ` — ${tailParts.join(', ')}`;
  }

  paragraph += '.';
  return paragraph;
}
