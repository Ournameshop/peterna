// Beat prompt assembly for Seedance 2.0 video generation.
// Server-side helper. Stateless — produces a single prompt string from
// the user's choices in the tribute builder.

import {
  cameraMovePhrase,
  subjectMotionPhrase,
  lightingMotionPhrase,
  archetypeMotionDirective,
  dofPhrase,
} from '@/lib/peternal-motion-phrasing';

import type {
  CameraMove,
  LightingMotion,
  DofBehavior,
  BeatArchetype,
} from '@/lib/peternal-library';

export interface CinematographyBriefInput {
  lensMm?: number;
  cameraMove?: string;
  moveIntensity?: string;
  subjectMotion?: string;
  lightingMotion?: string;
  dofBehavior?: string;
  // retained on interface for callers that still pass these — silently ignored in prompt
  lensCharacter?: string;
  shotStructure?: string;
  ambientAudio?: string;
  audioIntensity?: string;
}

export interface BuildBeatPromptInput {
  petName: string;
  species: string;
  traits?: string[];
  favorites?: string[];
  format?: string;
  theme?: string;
  style?: string;
  beatArchetype: string;
  brief: string;
  caption?: string;
  spokenOrTitle?: string;
  cinematographyBrief?: CinematographyBriefInput;
  userNote?: string;
}

export function buildBeatPrompt(input: BuildBeatPromptInput): string {
  const {
    petName,
    species,
    traits = [],
    favorites = [],
    format,
    theme,
    style,
    beatArchetype,
    brief,
    caption,
    spokenOrTitle,
    cinematographyBrief,
    userNote,
  } = input;

  const traitLine = traits.length ? ` Known traits: ${traits.join(", ")}.` : "";
  const favLine = favorites.length ? ` Loved: ${favorites.join(", ")}.` : "";
  const formatLine = format ? ` Format: ${format}.` : "";
  const themeLine = theme ? ` Environment: ${theme}.` : "";
  const styleLine = style ? ` Visual style: ${style}.` : "";

  const archetype = beatArchetype as BeatArchetype;
  const cb = cinematographyBrief;

  const lines: string[] = [];

  // 1. Likeness sentence — VERBATIM, skill hard rule.
  lines.push(
    `Replicate the exact likeness, markings, proportions, and distinguishing features of ${petName} from the reference images. Do not invent any other animal.`
  );

  // 2. Motion mandate.
  lines.push(
    "This is a moving cinematic video clip — NOT a still image. The scene must have continuous, visible motion from the first frame to the last."
  );

  // 3. Archetype motion directive.
  lines.push(archetypeMotionDirective(archetype, petName, species));

  // 4. Beat visual.
  lines.push(`Beat: ${archetype} — ${brief}`);

  // 5. Emotional intent (kept — do not render as text).
  const isCardArchetype = archetype === 'open' || archetype === 'close';
  const intentText = isCardArchetype ? caption : (spokenOrTitle || caption);
  if (intentText) {
    lines.push(
      `The emotional intent of this scene (do NOT render this as on-screen text — express it through imagery, the pet's posture, and mood): "${intentText}"`
    );
  }

  // 6. Subject + traits/favorites.
  lines.push(`Subject: ${petName}, a ${species} — same animal as in the reference images.${traitLine}${favLine}`);

  // 7. Theme/format/style context.
  const contextLine = `${formatLine}${themeLine}${styleLine}`.trim();
  if (contextLine) lines.push(contextLine);

  // 8. Camera move + lens.
  if (cb) {
    if (cb.cameraMove && cb.moveIntensity) {
      lines.push(
        cameraMovePhrase(cb.cameraMove as CameraMove, cb.moveIntensity as 'barely_perceptible' | 'gentle' | 'pronounced')
        + (cb.lensMm !== undefined ? ` Shot on a ${cb.lensMm}mm lens.` : '')
      );
    } else if (cb.lensMm !== undefined) {
      lines.push(`Shot on a ${cb.lensMm}mm lens.`);
    }

    // 9. Subject motion.
    if (cb.subjectMotion) {
      lines.push(
        subjectMotionPhrase(
          cb.subjectMotion as 'locked' | 'breath_only' | 'loop_idle' | 'loop_action' | 'one_shot_action',
          petName,
          species,
          brief,
        )
      );
    }

    // 10. Atmosphere: lighting motion + environmental motion note.
    if (cb.lightingMotion) {
      const lightLine = lightingMotionPhrase(cb.lightingMotion as LightingMotion);
      lines.push(lightLine + " The environment has subtle, natural motion — wind in grass, drifting clouds, or the gentle sway of surroundings.");
    }

    // 11. Depth of field.
    if (cb.dofBehavior) {
      lines.push(dofPhrase(cb.dofBehavior as DofBehavior));
    }
  }

  // 12. User review note.
  if (userNote && userNote.trim()) {
    lines.push(
      `The family reviewed this clip and asked for this change — apply it while keeping the pet's exact likeness: ${userNote.trim()}`
    );
  }

  // 13. Safety constraints — ends with motion mandate.
  lines.push(
    "No humans in frame. No imagery of illness, injury, or death. No text overlays, no watermarks. The clip must move — avoid a frozen or near-still result."
  );

  return lines.filter(Boolean).join("\n");
}

// ---- Tribute card prompt assembly ------------------------------------------
// Single image-generation prompt for a tribute card, assembled per the skill's
// variable-reference (peterna-tribute-card-variable-reference.md, Steps 1-4):
// pet identity + scene context (art style / theme) + caption container + the
// resolved caption text. The caption is passed in ALREADY resolved (pronouns
// and [PET_NAME] substituted) — the model renders it verbatim, it does NOT
// assemble the text itself.

const ART_STYLE_MEDIUM: Record<string, string> = {
  cinematic_realism: 'a warm cinematic photoreal still with soft natural light',
  watercolor: 'a soft hand-painted watercolor illustration on cream paper',
  storybook_illustration: "a tender hand-drawn children's storybook illustration",
  animated_3d: 'a soft 3D-animated film still with gentle volumetric light',
  claymation: 'a handmade stop-motion claymation still',
  pencil_sketch: 'a soft graphite pencil-sketch portrait on warm paper',
  pixel_art: 'chunky 16-bit pixel art',
  voxel_minecraft: 'a 3D voxel, Minecraft-style scene',
};

export interface TributeCardPromptInput {
  cardType: 'opening' | 'closing' | 'caption';
  resolvedCaption: string;     // already pronoun/name-resolved — rendered verbatim
  artStyle: string;            // ArtStyleId
  containerName: string;       // e.g. "Watercolor ribbon"
  containerSpec: string;       // the caption container's illustrated-object spec
  petName: string;
  species: string;
  breedGuess?: string;
  coatDescription?: string;
  ageRange?: string;
  theme?: string;
  sceneHint?: string;          // interior beat cards only
}

export function buildTributeCardPrompt(input: TributeCardPromptInput): string {
  const {
    cardType, resolvedCaption, artStyle, containerName, containerSpec,
    petName, species, breedGuess, coatDescription, ageRange, theme, sceneHint,
  } = input;

  const medium = ART_STYLE_MEDIUM[artStyle] ?? ART_STYLE_MEDIUM.watercolor;
  const lines: string[] = [];

  // Step 1 — subject identity. The character sheet is passed as a reference
  // image; this text reinforces the likeness.
  const petDesc = [breedGuess, coatDescription, ageRange].filter(Boolean).join(', ');
  lines.push(
    `Render ${petName}, the same ${species} from the reference image${petDesc ? ` (${petDesc})` : ''} — keep the exact likeness, markings and proportions. Do not invent a different animal.`
  );

  // Step 2 — scene context: the art-style medium.
  lines.push(`Rendering style: ${medium}.`);

  // Step 3 — beat-specific scene (interior cards) or a memorial portrait.
  if (cardType === 'caption' && sceneHint) {
    lines.push(`Scene: ${petName} ${sceneHint}.`);
  } else {
    const kind = cardType === 'opening' ? 'opening title' : cardType === 'closing' ? 'closing' : 'memory';
    lines.push(`A tender memorial ${kind} portrait of ${petName}, calm and at peace.`);
  }
  if (theme) lines.push(`Environment and mood: ${theme.replace(/_/g, ' ')}.`);

  // Step 4 — caption container + the resolved caption text, rendered verbatim.
  lines.push(`In the lower portion of the image, place the caption container — ${containerName}: ${containerSpec}`);
  lines.push(
    `On the caption container, render exactly this text, spelled perfectly and completely with no extra or missing words: "${resolvedCaption}". Render it in elegant lettering that suits the container and the art style.`
  );

  // Safety + composition.
  lines.push(
    'No humans in frame. No imagery of illness, injury or death. No watermarks. Vertical portrait composition — the pet in the upper portion, the caption container below, the pet’s face never covered.'
  );

  return lines.filter(Boolean).join('\n');
}
