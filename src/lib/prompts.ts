// Beat prompt assembly for Seedance 2.0 video generation.
// Server-side helper. Stateless — produces a single prompt string from
// the user's choices in the tribute builder.

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
  } = input;

  const traitLine = traits.length ? ` Known traits: ${traits.join(", ")}.` : "";
  const favLine = favorites.length ? ` Loved: ${favorites.join(", ")}.` : "";
  const formatLine = format ? ` Format: ${format}.` : "";
  const themeLine = theme ? ` Environment: ${theme}.` : "";
  const styleLine = style ? ` Visual style: ${style}.` : "";

  return [
    `Scene: ${beatArchetype} — ${brief}`,
    `Subject: ${petName}, a ${species} — same animal as in the reference images.${traitLine}${favLine}`,
    `${formatLine}${themeLine}${styleLine}`.trim(),
    `Cinematography: lens 50mm, gentle handheld motion, soft subject movement, warm golden-hour lighting, shallow depth of field.`,
    `Audio: ambient natural sound matching the environment.`,
    `NO text overlays. NO watermarks. NO captions baked into the video.`,
    `The pet's appearance must exactly match the reference images.`,
  ]
    .filter(Boolean)
    .join("\n");
}
