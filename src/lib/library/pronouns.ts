// Gender options + pronouns/vocatives table, transcribed verbatim from the
// spec's embedded library YAML (SKILL v2.3, §EMBEDDED ASSET LIBRARY).
//
// Three keys are mandatory (male / female / neutral); the load-time validator
// in `index.ts` enforces this. `gender` is captured explicitly in Stage 1.7
// and is NEVER inferred from photos.

export type GenderId = 'male' | 'female' | 'neutral';

export type GenderOption = {
  readonly id: GenderId;
  readonly label: string;
  readonly sublabel: string;
  readonly description: string;
};

export const GENDER_OPTIONS: ReadonlyArray<GenderOption> = [
  {
    id: 'male',
    label: 'He',
    sublabel: "we'll use he/him throughout",
    description: 'he/him/his pronouns',
  },
  {
    id: 'female',
    label: 'She',
    sublabel: "we'll use she/her throughout",
    description: 'she/her/her pronouns',
  },
  {
    id: 'neutral',
    label: 'They',
    sublabel: "we'll use they/them throughout",
    description: 'gender-neutral pronouns',
  },
] as const;

export type PronounSet = {
  readonly pronoun_subject: string;
  readonly pronoun_object: string;
  readonly pronoun_possessive: string;
  readonly pronoun_reflexive: string;
  readonly vocative_plain: string;
  readonly vocative: string;
  readonly vocative_buddy: string;
  readonly vocative_good: string;
  readonly vocative_dear: string;
};

export const PRONOUNS_AND_VOCATIVES: Readonly<Record<GenderId, PronounSet>> = {
  male: {
    pronoun_subject: 'he',
    pronoun_object: 'him',
    pronoun_possessive: 'his',
    pronoun_reflexive: 'himself',
    vocative_plain: 'boy',
    vocative: 'sweet boy',
    vocative_buddy: 'buddy',
    vocative_good: 'good boy',
    vocative_dear: 'dear boy',
  },
  female: {
    pronoun_subject: 'she',
    pronoun_object: 'her',
    pronoun_possessive: 'her',
    pronoun_reflexive: 'herself',
    vocative_plain: 'girl',
    vocative: 'sweet girl',
    vocative_buddy: 'sweetheart',
    vocative_good: 'good girl',
    vocative_dear: 'dear girl',
  },
  neutral: {
    pronoun_subject: 'they',
    pronoun_object: 'them',
    pronoun_possessive: 'their',
    pronoun_reflexive: 'themself',
    vocative_plain: 'one',
    vocative: 'sweet one',
    vocative_buddy: 'dear friend',
    vocative_good: 'good one',
    vocative_dear: 'dear one',
  },
} as const;
