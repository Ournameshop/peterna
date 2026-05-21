import 'server-only';

/**
 * Vision-pass prompt template (SERVER-ONLY) — used internally by Stage 1.4. Sent to the
 * multimodal model along with all uploaded photos and the pet's name. Mirrors
 * `vision_pass_prompt` in the SKILL spec (Peternal v2.3) verbatim.
 *
 * Substitution: callers must replace `[PET_NAME]` with the captured pet_name (or the literal
 * string "your pet" if not yet captured) before sending to the vendor.
 */
export const VISION_PASS_PROMPT = `You are analyzing photos of a beloved pet named [PET_NAME] for a memorial tribute.
Return ONLY a JSON object matching this schema:

{
  "species": "dog|cat|rabbit|bird|hamster|guinea_pig|ferret|reptile|fish|horse|other",
  "species_confidence": "high|medium|low",
  "breed_guess": "best-effort breed or breed family description",
  "breed_confidence": "high|medium|low",
  "coat_description": "color, pattern, distinctive markings",
  "coat_confidence": "high|medium|low",
  "age_range": "puppy_kitten|young_adult|adult|senior",
  "age_confidence": "high|medium|low",
  "body_type": "tiny|small|medium|large|giant",
  "body_confidence": "high|medium|low",
  "observed_setting": "where the photos appear to be taken",
  "setting_confidence": "high|medium|low",
  "observed_moment": "what the pet is doing in the photos",
  "moment_confidence": "high|medium|low"
}

Rules:
- NEVER infer or include gender. If you have a guess, do not include it.
- NEVER project emotional state ("looks happy", "seems sad"). Only describe body position.
- NEVER infer specific age in years. Only age class.
- NEVER infer personality from a single photo. Only what you can see.
- If a field cannot be inferred with at least medium confidence, set its
  confidence to "low" and leave the value as the best-effort guess.
- If species cannot be inferred even at medium confidence, return:
  {"vision_failure": true} and nothing else.

Output the JSON only. No prose.` as const;

const SPECIES_VALUES = [
  'dog',
  'cat',
  'rabbit',
  'bird',
  'hamster',
  'guinea_pig',
  'ferret',
  'reptile',
  'fish',
  'horse',
  'other',
] as const;

const AGE_VALUES = ['puppy_kitten', 'young_adult', 'adult', 'senior'] as const;
const BODY_VALUES = ['tiny', 'small', 'medium', 'large', 'giant'] as const;
const CONFIDENCE_VALUES = ['high', 'medium', 'low'] as const;

/**
 * JSON Schema describing the structured pet_profile output (Stage 1.4).
 * `strict: true`-compatible: every property is `required`, `additionalProperties: false`.
 * Optional fields per the SKILL spec (`body_type`, `observed_setting`, `observed_moment`) are
 * marked required at the schema level but the model may emit `null` to signal absence.
 */
export const PET_PROFILE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'species',
    'species_confidence',
    'breed_guess',
    'breed_confidence',
    'coat_description',
    'coat_confidence',
    'age_range',
    'age_confidence',
    'body_type',
    'body_confidence',
    'observed_setting',
    'setting_confidence',
    'observed_moment',
    'moment_confidence',
  ],
  properties: {
    species: { type: 'string', enum: [...SPECIES_VALUES] },
    species_confidence: { type: 'string', enum: [...CONFIDENCE_VALUES] },
    breed_guess: { type: 'string' },
    breed_confidence: { type: 'string', enum: [...CONFIDENCE_VALUES] },
    coat_description: { type: 'string' },
    coat_confidence: { type: 'string', enum: [...CONFIDENCE_VALUES] },
    age_range: { type: 'string', enum: [...AGE_VALUES] },
    age_confidence: { type: 'string', enum: [...CONFIDENCE_VALUES] },
    body_type: { type: ['string', 'null'], enum: [...BODY_VALUES, null] },
    body_confidence: { type: 'string', enum: [...CONFIDENCE_VALUES] },
    observed_setting: { type: ['string', 'null'] },
    setting_confidence: { type: 'string', enum: [...CONFIDENCE_VALUES] },
    observed_moment: { type: ['string', 'null'] },
    moment_confidence: { type: 'string', enum: [...CONFIDENCE_VALUES] },
  },
} as const;

export type PetProfileSpecies = (typeof SPECIES_VALUES)[number];
export type PetProfileAge = (typeof AGE_VALUES)[number];
export type PetProfileBody = (typeof BODY_VALUES)[number];
export type ConfidenceLevel = (typeof CONFIDENCE_VALUES)[number];

/** Vision-pass per-field structured output (post-schema). Mirrors the flat shape the model emits. */
export type PetProfile = {
  species: PetProfileSpecies;
  breed_guess: string;
  coat_description: string;
  age_range: PetProfileAge;
  body_type: PetProfileBody | null;
  observed_setting: string | null;
  observed_moment: string | null;
};

export type PetProfileConfidence = {
  species: ConfidenceLevel;
  breed_guess: ConfidenceLevel;
  coat_description: ConfidenceLevel;
  age_range: ConfidenceLevel;
  body_type: ConfidenceLevel;
  observed_setting: ConfidenceLevel;
  observed_moment: ConfidenceLevel;
};
