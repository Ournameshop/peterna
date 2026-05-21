// Beat prompt assembly for Seedance 2.0 video generation.
// Server-side helper. Stateless — produces a single prompt string from
// the user's choices in the tribute builder.

export interface CinematographyBriefInput {
  lensMm?: number;
  lensCharacter?: string;
  cameraMove?: string;
  moveIntensity?: string;
  subjectMotion?: string;
  lightingMotion?: string;
  dofBehavior?: string;
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

  const lines: string[] = [];

  // (a) mandatory likeness sentence
  lines.push(
    `Replicate the exact likeness, markings, proportions, and distinguishing features of ${petName} from the reference images. Do not invent any other animal.`
  );

  // (b) beat archetype + visual/brief
  lines.push(`Beat: ${beatArchetype} — ${brief}`);
  // For open/close archetypes spokenOrTitle is the card title (the pet's name), not an
  // emotional intent — injecting it would contradict the "No text overlays" safety line.
  const isCardArchetype = beatArchetype === 'open' || beatArchetype === 'close';
  const intentText = isCardArchetype ? caption : (spokenOrTitle || caption);
  if (intentText) {
    lines.push(
      `The emotional intent of this scene (do NOT render this as on-screen text — express it through imagery, the pet's posture, and mood): "${intentText}"`
    );
  }
  lines.push(`Subject: ${petName}, a ${species} — same animal as in the reference images.${traitLine}${favLine}`);

  // (c) theme + format + style
  const contextLine = `${formatLine}${themeLine}${styleLine}`.trim();
  if (contextLine) lines.push(contextLine);

  // (d) cinematography brief field values (source of truth)
  if (cinematographyBrief) {
    const cb = cinematographyBrief;
    const cineParts: string[] = [];
    if (cb.lensMm !== undefined) cineParts.push(`lens ${cb.lensMm}mm`);
    if (cb.lensCharacter) cineParts.push(`character: ${cb.lensCharacter}`);
    if (cb.cameraMove) cineParts.push(`camera move: ${cb.cameraMove}`);
    if (cb.moveIntensity) cineParts.push(`intensity: ${cb.moveIntensity}`);
    if (cb.subjectMotion) cineParts.push(`subject motion: ${cb.subjectMotion}`);
    if (cb.lightingMotion) cineParts.push(`lighting: ${cb.lightingMotion}`);
    if (cb.dofBehavior) cineParts.push(`depth of field: ${cb.dofBehavior}`);
    if (cb.shotStructure) cineParts.push(`shot structure: ${cb.shotStructure}`);
    if (cineParts.length) lines.push(`Cinematography: ${cineParts.join(", ")}.`);

    // (e) ambientAudio + audioIntensity
    const audioParts: string[] = [];
    if (cb.ambientAudio) audioParts.push(cb.ambientAudio);
    if (cb.audioIntensity) audioParts.push(`intensity: ${cb.audioIntensity}`);
    if (audioParts.length) lines.push(`Audio: ${audioParts.join(", ")}.`);
  }

  // (f) user review note
  if (userNote && userNote.trim()) {
    lines.push(
      `The family reviewed this clip and asked for this change — apply it while keeping the pet's exact likeness: ${userNote.trim()}`
    );
  }

  // (g) safety constraints
  lines.push(
    "No humans in frame. No imagery of illness, injury, or death. No text overlays, no watermarks."
  );

  return lines.filter(Boolean).join("\n");
}
