# Copy and content — locked verbatim copy + library shape

**Owner / agent type:** Frontend (with copy review by PM / Xee).
**Prerequisites:** read `architecture.md` §3 first.

## Library file layout

Server-only TS modules under `src/lib/library/`. Compile to ~30–40 KB JS total.

```
src/lib/library/
  pronouns.ts          // gender_options (= 3), pronouns_and_vocatives (3 keys: male/female/neutral)
  formats.ts           // ≥ 8 formats + beat templates for 8/12/16 beat_count
  themes.ts            // ≥ 12 themes + 6 categories
  art-styles.ts        // ≥ 8 styles — full directive strings (SERVER-ONLY)
  containers.ts        // 13 caption containers (8 style-paired + 5 memorial) (SERVER-ONLY) — Phase 4+ use only
  curators-picks.ts    // ≥ 4 picks (default-ordered) + curators_pick_priority per relationship
  relationships.ts     // ≥ 7 relationships + default_theme_bias[] + curators_pick_priority
  intake.ts            // memory_prompts (= 3), personality_traits (≥ 10), favorite_things (≥ 12)
  words.ts             // opening_archetypes (≥ 7), closing_archetypes (≥ 7), caption_templates (≥ 8 keys)
  vision-pass.ts       // vision_pass_prompt (SERVER-ONLY) + pet_profile_schema (JSON Schema object)
  defaults.ts          // default_words, default_music
  copy.ts              // LOCKED verbatim user-facing strings (Stage 1.0 welcome, Stage 1.5 framing, button labels, observation-paragraph templates, stage banners)
  index.ts             // re-exports with type-only barrel
```

## Server-only enforcement

Files marked SERVER-ONLY above include `import 'server-only'` at the top. These are prompt-engineering IP — do not ship to the client bundle:
- `art_styles[].directive` (full style directive strings)
- `containers[]` specs
- `vision_pass_prompt`
- `caption_templates`

`copy.ts`, `pronouns.ts`, `gender_options`, `formats[].name`/`description`, `themes[].name`/`description`, `relationships[].label`, `intake.ts` button labels are client-safe.

## Locked verbatim copy (selection)

### Stage 1.0 welcome (LOCKED, do not paraphrase)

```
I'm so glad you're here for [pet]. Let's make something beautiful together.

Before we begin — I won't ask you about their last day, or how they passed.
If you ever want to share that, you can, but I'll never push for it.

We'll go slowly, one question at a time. Every step is skippable.
You can redo anything as many times as you need — there's no rush,
and nothing here is permanent until you say it is.

Ready when you are.
```

Substitute `[pet]` with `pet_name` if captured, else literal string `'your pet'`. Render full-bleed centered, `FONT_DISPLAY` from `peterna-tokens.ts`, warm cream background. **No "Continue" button** — the user advances by completing the next form (`intake_photos`) below the welcome.

### Stage 1.5 "Here's what I see" framing (LOCKED)

```
Here's what I see in your photos of [PET_NAME]:

[OBSERVATION PARAGRAPH]

Does that sound right? Tap anything you'd like to change.
```

### Observation paragraph templates

Compose from inferred fields. Tone rules (HARD):
- "Looks like" / "I see" — never "is" or "must be"
- High-confidence fields = statements; medium-confidence = hedged; low-confidence = omitted
- 2–3 fields max per sentence
- Never project emotional state ("happy", "sad")

Example outputs:
- `"Spike looks like a white parti-color boxer with a dark eye mask — a young adult, lying on a tile floor in one of your photos."`
- `"Luna looks like a tabby with white socks and chest — a senior cat, curled on what looks like a soft blanket."`

### Stage banners

| Stage | Banner |
|---|---|
| 1. Intake | 🌿 Stage 1: Tell me about [PET_NAME] — photos, name, what we see, the essentials |
| 2. Character Sheet | 🐾 Stage 2: Character sheet — locking [PET_NAME]'s likeness |
| 3. Format, Theme & Style | 🎬 Stage 3: Choosing the kind of tribute, the world it lives in, and how it's painted |

(Banners for Stages 4–8 are documented in the spec but not used in Phase 1.)

### Button-label crib

| Context | Labels |
|---|---|
| 1.1 Returning user | "No, this is my first" / "Yes, I've done this before" |
| 1.5 Confirmation card actions | "Yes, that's [PET_NAME]" / "Let me fix something" |
| 1.7 Gender | "He" / "She" / "They" |
| 2.2 Character sheet review | "Yes, that's them" / "Close, but something's off" / "Try again from scratch" / "Let me add more photos" |
| 2.5 Length | "A short keepsake" / "A full tribute" *(recommended)* / "An extended remembrance" |
| 2.6 Aspect | "On my phone" *(recommended)* / "On a TV or computer" / "Social feeds" / "All three formats" |
| 3.5 Preview review | "Yes, this is it" / "Try a different style" / "Try a different theme" / "Try a different format" / "Start the picks over" |

## Language rules (HARD, from spec)

- Never narrate technical mechanics — no model names, no vendor names, no UUIDs, no "running parallel searches" in user-facing copy.
- Never use cost-pressure language at any gate. No "this will use X credits," no "are you sure," no "last chance."
- Refer to the pet by name from the moment the name is captured.
- Re-rolls are framed as "let's get it right," not as expensive.
- No imagery of illness, injury, or death anywhere in prompts (this is in the prompt builders, but copy must not reference it either).

## Where copy lives in code

- Locked verbatim strings → `src/lib/library/copy.ts`. Exported as named consts (`WELCOME_COPY`, `CONFIRMATION_FRAMING`, etc.).
- Button labels → co-located with the screen component if they're one-off; in `copy.ts` if they're reused.
- Observation paragraph composition → `src/lib/library/copy.ts::composeObservationParagraph(profile, confidence): string`.

## Type contracts (sketch)

```ts
type GenderId = 'male' | 'female' | 'neutral';
type FormatId = 'music_video' | 'biopic' | 'day_in_the_life' | 'letter_to_my_pet' | 'their_greatest_hits' | 'send_off' | 'postcards_from' | 'forever_young';
type ThemeCategoryId = 'healing_peace' | 'quiet_grief' | 'home_everyday_love' | 'nature_freedom' | 'their_personality' | 'spiritual_symbolic';
type ArtStyleId = 'cinematic_realism' | 'watercolor' | 'storybook_illustration' | 'animated_3d' | 'claymation' | 'pencil_sketch' | 'pixel_art' | 'voxel_minecraft';
type RelationshipId = 'childhood' | 'partnership' | 'companion_through_grief' | 'family_first' | 'rescue_last_chapter' | 'always_mine' | 'unspecified';
type CuratorsPickId = 'classic_send_off' | 'joyful_celebration' | 'quiet_goodbye' | 'storybook_for' | 'quiet_remembrance' | 'forever_in_stone';
type AspectRatio = '9:16' | '16:9' | '1:1' | 'all_three';
```
