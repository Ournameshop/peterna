"use client";

// Generation helpers for the builder wizard — reference-image conditioned,
// per the Peternal skill. The skill mandates openai/gpt-image-2 for every
// still, and a HARD likeness rule: the character sheet is generated FROM the
// user's actual photos, and every downstream frame is generated FROM the
// character sheet — so it stays the SAME pet. Plain text-to-image is NOT used.
//
// Images:  /api/image/edit  -> fal openai/gpt-image-2/edit (reference-conditioned)
// Vision/text: /api/gemini  -> Gemini (photo analysis only)
//
// Everything resolves to null on failure so callers fall back to the SVG art.

import { themes, artStyles, formats, captionContainers } from '@/lib/peternal-library';
import type { ThemeId, ArtStyleId, FormatId, ContainerId } from '@/lib/peternal-library';
import type { PetProfile, PetPhoto, Beat, AspectId, CinematographyBrief } from '../state';

// ---- helpers ---------------------------------------------------------------

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function splitDataUrl(dataUrl: string): { data: string; mimeType: string } {
  const comma = dataUrl.indexOf(',');
  const header = dataUrl.slice(5, comma); // e.g. "image/jpeg;base64"
  return { data: dataUrl.slice(comma + 1), mimeType: header.split(';')[0] || 'image/jpeg' };
}

// A photo becomes either a data: URI (uploaded file) or its pasted URL.
async function photoToImageUrl(photo: PetPhoto): Promise<string | null> {
  if (photo.file) return fileToDataUrl(photo.file);
  if (photo.url) return photo.url;
  return null;
}

type FalAspect = 'square_hd' | 'portrait_16_9' | 'landscape_16_9';
function falAspect(aspect: AspectId): FalAspect {
  switch (aspect) {
    case '16:9':
      return 'landscape_16_9';
    case '1:1':
      return 'square_hd';
    default:
      return 'portrait_16_9'; // 9:16 + all_three (master is vertical)
  }
}

// Skill: Likeness reference rule (HARD) — every downstream prompt starts here.
function likenessSentence(petName: string): string {
  return `Replicate the exact likeness, markings, proportions, and distinguishing features of ${petName} from the reference image. Do not invent any other animal.`;
}

// /api/image/edit -> fal openai/gpt-image-2/edit. Reference-conditioned.
async function editImage(opts: {
  prompt: string;
  imageUrls: string[];
  aspect: FalAspect | 'auto';
  quality: 'low' | 'medium' | 'high';
}): Promise<string | null> {
  // Abort guard — a hung request must never freeze the wizard; it falls back to SVG.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 180_000);
  try {
    const res = await fetch('/api/image/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: opts.prompt,
        imageUrls: opts.imageUrls,
        aspect: opts.aspect,
        quality: opts.quality,
        outputFormat: 'jpeg',
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { url?: string };
    return typeof json.url === 'string' ? json.url : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---- Gemini: pet-photo analysis (vision) -----------------------------------

const PROFILE_PROMPT = `You are helping a grieving owner create a loving memorial for their pet.
Look at this photo and describe the pet. Respond with ONLY a JSON object, no markdown, exactly this shape:
{
  "species": "Dog | Cat | Rabbit | etc",
  "breedGuess": "best guess at breed, or 'Mixed breed'",
  "coatDescription": "short warm description of coat colour and markings, e.g. 'warm tan with a cream chest'",
  "ageRange": "puppy_kitten | young_adult | adult | senior",
  "bodyType": "tiny | small | medium | large | giant",
  "observedSetting": "short phrase, e.g. 'indoors in warm light'",
  "observedMoment": "short phrase, e.g. 'at rest, gaze lifted'"
}
Be gentle and specific. If unsure, make a kind, reasonable guess.`;

function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}
function normalizeAge(v: unknown): PetProfile['ageRange'] {
  const s = String(v ?? '').toLowerCase();
  if (s.includes('pupp') || s.includes('kitt') || s.includes('baby')) return 'puppy_kitten';
  if (s.includes('young')) return 'young_adult';
  if (s.includes('senior') || s.includes('old') || s.includes('elder')) return 'senior';
  return 'adult';
}
function normalizeBody(v: unknown): PetProfile['bodyType'] {
  const s = String(v ?? '').toLowerCase();
  if (s === 'tiny' || s === 'small' || s === 'medium' || s === 'large' || s === 'giant') return s;
  return 'medium';
}

export async function analyzePetPhoto(photo: PetPhoto): Promise<PetProfile | null> {
  try {
    const payload: {
      mode: 'vision';
      prompt: string;
      imageBase64?: string;
      imageMimeType?: string;
      imageUrl?: string;
    } = { mode: 'vision', prompt: PROFILE_PROMPT };

    if (photo.file) {
      const { data, mimeType } = splitDataUrl(await fileToDataUrl(photo.file));
      payload.imageBase64 = data;
      payload.imageMimeType = mimeType;
    } else if (photo.url) {
      payload.imageUrl = photo.url;
    } else {
      return null;
    }

    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const { text } = (await res.json()) as { text?: string };
    if (!text) return null;

    const parsed = JSON.parse(stripFences(text)) as Record<string, unknown>;
    return {
      species: String(parsed.species ?? 'Pet'),
      speciesConfidence: 'high',
      breedGuess: String(parsed.breedGuess ?? 'Mixed breed'),
      breedConfidence: 'medium',
      coatDescription: String(parsed.coatDescription ?? 'a warm, much-loved coat'),
      coatConfidence: 'high',
      ageRange: normalizeAge(parsed.ageRange),
      ageConfidence: 'medium',
      bodyType: normalizeBody(parsed.bodyType),
      observedSetting: parsed.observedSetting ? String(parsed.observedSetting) : undefined,
      observedMoment: parsed.observedMoment ? String(parsed.observedMoment) : undefined,
      visionFailed: false,
    };
  } catch {
    return null;
  }
}

// ---- Gemini: text ----------------------------------------------------------

export async function generateText(prompt: string): Promise<string | null> {
  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'text', prompt }),
    });
    if (!res.ok) return null;
    const { text } = (await res.json()) as { text?: string };
    return typeof text === 'string' && text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}

// ---- Character sheet (skill Stage 2.1) -------------------------------------
// ONE 2x2-grid reference image generated from ALL the user's uploaded photos.
// The returned fal URL becomes the character sheet — the reference for frames.

export async function generateCharacterSheet(
  photos: PetPhoto[],
  petName: string,
  profile: PetProfile | null,
  userNote?: string,        // free-text from the Gate 1 corrections box
  refinements?: string[],   // "something's off" chips: ears / eyes / fur / ...
): Promise<string | null> {
  const urls = (await Promise.all(photos.map(photoToImageUrl))).filter(
    (u): u is string => !!u,
  );
  if (urls.length === 0) return null;

  const species = (profile?.species ?? 'pet').toLowerCase();
  const breed = profile?.breedGuess ? `${profile.breedGuess} ` : '';

  // Skill Stage 2.3 — on a re-roll, embed the family's corrections in the prompt.
  const note = userNote?.trim();
  const refineList = (refinements ?? []).filter(Boolean).map((r) => r.replace(/_/g, ' '));
  const corrections =
    refineList.length || note
      ? `\n\nThe family reviewed a previous attempt and asked for corrections — apply these while keeping it unmistakably the same ${species}:${
          refineList.length ? ` adjust the ${refineList.join(', ')}.` : ''
        }${note ? ` ${note}` : ''}`
      : '';

  const prompt = `A character reference sheet for ${petName}, a ${breed}${species}. Four views arranged in a 2x2 grid on a clean neutral background:
- Top left: Front-facing portrait, head and shoulders, looking at the camera.
- Top right: 3-quarter angle portrait, head and shoulders, slight smile/relaxed expression.
- Bottom left: Full side profile, full body, standing in a neutral pose.
- Bottom right: Full body relaxed pose — sitting or lying down, alert and content.

Replicate the EXACT likeness, markings, fur color and pattern, ear shape, eye color, body proportions, and distinguishing features from the reference photos. Soft natural studio lighting. Realistic, warm, alive. No background scenery — clean off-white backdrop. No text, no labels, no watermarks.${corrections}`;

  return editImage({ prompt, imageUrls: urls, aspect: 'square_hd', quality: 'medium' });
}

// ---- Storyboard frame (skill Stage 5.1) ------------------------------------
// One frame per beat, conditioned on the character sheet so it's the SAME pet.

export async function generateStoryboardFrame(
  beat: Beat,
  characterSheet: string | null,
  petName: string,
  themeId: ThemeId | null,
  styleId: ArtStyleId | null,
  formatId: FormatId | null,
  aspect: AspectId,
  userNote?: string,
  priorFrameUrl?: string, // the existing frame — a note-driven re-render EDITS this
): Promise<string | null> {
  if (!characterSheet) return null; // no reference => no likeness => fall back to SVG

  const theme = themes.find((t) => t.id === themeId);
  const style = artStyles.find((s) => s.id === styleId);
  const format = formats.find((f) => f.id === formatId);
  const note = userNote?.trim();

  // Note-driven re-render → EDIT the frame the user is looking at (pass it as the
  // primary reference) so the requested change is visibly applied, instead of
  // producing an unrelated fresh frame. No note → a fresh take from the char sheet.
  const editMode = !!(note && priorFrameUrl);

  let prompt: string;
  if (editMode) {
    prompt = `${likenessSentence(petName)}

Edit the FIRST reference image. Keep its composition, framing, scene and mood as they are — change ONLY what the family requested: ${note}

Keep ${petName}'s exact likeness (use the second reference). No humans in frame. No imagery of illness, injury, or death. No text or watermarks.`;
  } else {
    // Skill Stage 5.1 prompt: use the theme's short DESCRIPTION (not its
    // standalone imagePrompt — that is a fixed pet-less preview scene and makes
    // every frame identical). The per-beat Visual is what drives variety.
    prompt = `${likenessSentence(petName)}

${petName} is the clear subject of this frame and must be visibly present within the scene, matching the reference exactly.

Beat #${beat.index + 1}: ${beat.name}.
Visual: ${beat.visual}.
${theme ? `Theme & mood: ${theme.name} — ${theme.desc}` : ''}
${format ? `Format context: ${format.name} — ${format.desc}` : ''}

Composition: choose framing for this specific beat — wide for establishing beats, medium for relational beats, medium-wide for active beats. Vary the framing, camera angle, and the pet's pose from one beat to the next so no two frames look alike. Avoid extreme close-ups unless the beat is intimate.
Lighting: soft, warm, gentle. No humans in frame. No imagery of illness, injury, or death.
${style ? `Art style: ${style.directive}` : ''}${note ? `

IMPORTANT — the family reviewed this frame and asked for this specific change. Apply it while keeping ${petName}'s exact likeness from the reference: ${note}` : ''}`;
  }

  return editImage({
    prompt,
    imageUrls: editMode && priorFrameUrl ? [priorFrameUrl, characterSheet] : [characterSheet],
    aspect: falAspect(aspect),
    quality: 'low',
  });
}

// ---- Combination preview (skill Stage 3.5) ---------------------------------
// ONE "first look" frame of the pet in the chosen format + theme + style.

export async function generateCombinationPreview(
  characterSheet: string | null,
  petName: string,
  themeId: ThemeId | null,
  styleId: ArtStyleId | null,
  formatId: FormatId | null,
  aspect: AspectId,
): Promise<string | null> {
  if (!characterSheet) return null;

  const theme = themes.find((t) => t.id === themeId);
  const style = artStyles.find((s) => s.id === styleId);
  const format = formats.find((f) => f.id === formatId);

  const prompt = `${likenessSentence(petName)}

A single representative "first look" frame of ${petName} for a memorial tribute. ${petName} is the clear subject, present in the scene, matching the reference exactly. Warm, gentle and emotionally resonant — it should capture the overall feel of the whole tribute at a glance.
${theme ? `Theme & mood: ${theme.name} — ${theme.desc}` : ''}
${format ? `Tribute format: ${format.name} — ${format.desc}` : ''}

Soft, warm, gentle lighting. No humans in frame. No imagery of illness, injury, or death.
${style ? `Art style: ${style.directive}` : ''}`;

  return editImage({
    prompt,
    imageUrls: [characterSheet],
    aspect: falAspect(aspect),
    quality: 'low',
  });
}

// ---- Card image (skill Stage 5.6) ------------------------------------------
// Deterministic typography renderer — POSTs to /api/card/render (resvg-based).
// Keeps the same exported signature so callers don't churn; characterSheet /
// themeId are accepted but ignored (the renderer is style-driven, not AI).

async function renderCardImage(opts: {
  cardType: 'opening' | 'closing' | 'caption' | 'caption_overlay';
  text: string;
  containerId: ContainerId | null;
  styleId: ArtStyleId | null;
  aspect: AspectId;
  backgroundImageUrl?: string;
}): Promise<string | null> {
  const aspectMap: Record<AspectId, '9:16' | '16:9' | '1:1'> = {
    '9:16': '9:16',
    '16:9': '16:9',
    '1:1': '1:1',
    'all_three': '9:16',
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const body: Record<string, string> = {
      cardType: opts.cardType,
      text: opts.text,
      containerId: opts.containerId ?? 'cinematic_lower_third',
      artStyle: opts.styleId ?? 'cinematic_realism',
      aspectRatio: aspectMap[opts.aspect] ?? '9:16',
    };
    if (opts.backgroundImageUrl) body.backgroundImageUrl = opts.backgroundImageUrl;
    const res = await fetch('/api/card/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { url?: string };
    return typeof json.url === 'string' ? json.url : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function generateCardImage(opts: {
  kind: 'opening' | 'closing' | 'caption';
  text: string;
  characterSheet: string | null;
  containerId: ContainerId | null;
  themeId: ThemeId | null;
  styleId: ArtStyleId | null;
  aspect: AspectId;
  userNote?: string;
  backgroundImageUrl?: string;
}): Promise<string | null> {
  return renderCardImage({
    cardType: opts.kind,
    text: opts.text,
    containerId: opts.containerId,
    styleId: opts.styleId,
    aspect: opts.aspect,
    backgroundImageUrl: opts.backgroundImageUrl,
  });
}

// ---- Caption overlay image (P1) --------------------------------------------
// Generates a transparent-background PNG of the caption panel only,
// for alpha-compositing over beat footage.

export async function generateCaptionOverlay(opts: {
  text: string;
  containerId: ContainerId | null;
  styleId: ArtStyleId | null;
  aspect: AspectId;
}): Promise<string | null> {
  return renderCardImage({
    cardType: 'caption_overlay',
    text: opts.text,
    containerId: opts.containerId,
    styleId: opts.styleId,
    aspect: opts.aspect,
  });
}

// ---- Video generation (skill Stage 6.1) ------------------------------------
// generateBeatVideo: submits a Seedance 2.0 job for one beat (non-blocking).
// pollBeatVideo: checks status of a queued job.

type SeedanceAspect = '9:16' | '16:9' | '1:1';

function seedanceAspect(aspect: AspectId): SeedanceAspect {
  switch (aspect) {
    case '16:9': return '16:9';
    case '1:1': return '1:1';
    default: return '9:16'; // 9:16 + all_three (master is vertical)
  }
}

export async function generateBeatVideo(opts: {
  beat: Beat;
  brief: CinematographyBrief;
  imageUrls: string[];
  petName: string;
  species: string;
  traits: string[];
  favorites: string[];
  format: string | null;
  theme: string | null;
  style: string | null;
  aspectRatio: AspectId;
  duration?: string;
  userNote?: string;
}): Promise<{ requestId: string; endpoint: string } | null> {
  try {
    const res = await fetch('/api/video/beat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        beat: {
          archetype: opts.beat.archetype,
          brief: opts.beat.visual,
          caption: opts.beat.caption,
          spokenOrTitle: opts.beat.spokenOrTitle,
        },
        pet: { name: opts.petName, species: opts.species, traits: opts.traits, favorites: opts.favorites },
        format: opts.format ?? undefined,
        theme: opts.theme ?? undefined,
        style: opts.style ?? undefined,
        imageUrls: opts.imageUrls,
        duration: opts.duration,
        aspectRatio: seedanceAspect(opts.aspectRatio),
        mode: 'fast',
        wait: false,
        userNote: opts.userNote,
        cinematographyBrief: {
          lensMm: opts.brief.lensMm,
          lensCharacter: opts.brief.lensCharacter,
          cameraMove: opts.brief.cameraMove,
          moveIntensity: opts.brief.moveIntensity,
          subjectMotion: opts.brief.subjectMotion,
          lightingMotion: opts.brief.lightingMotion,
          dofBehavior: opts.brief.dofBehavior,
          shotStructure: opts.brief.shotStructure,
          ambientAudio: opts.brief.ambientAudio,
          audioIntensity: opts.brief.audioIntensity,
        },
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { requestId?: string; endpoint?: string };
    if (!json.requestId || !json.endpoint) return null;
    return { requestId: json.requestId, endpoint: json.endpoint };
  } catch {
    return null;
  }
}

export async function pollBeatVideo(
  endpoint: string,
  requestId: string,
): Promise<{ status: string; url?: string } | null> {
  try {
    const res = await fetch(
      `/api/video/status?endpoint=${encodeURIComponent(endpoint)}&requestId=${encodeURIComponent(requestId)}`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { status?: string; url?: string };
    if (!json.status) return null;
    return { status: json.status, url: json.url };
  } catch {
    return null;
  }
}
