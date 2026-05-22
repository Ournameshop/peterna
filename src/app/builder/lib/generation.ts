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

import { themes, artStyles, formats, captionContainers, narrationQuestions, relationships } from '@/lib/peternal-library';
import type { ThemeId, ArtStyleId, FormatId, ContainerId } from '@/lib/peternal-library';
import type { PetProfile, PetPhoto, Beat, AspectId, CinematographyBrief, BuilderState } from '../state';
import { buildTributeCardPrompt } from '@/lib/prompts';

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

// Converts cloud-storage "share" links (Google Drive, Dropbox) into direct,
// fetchable image URLs. A Drive/Dropbox share link points at an HTML preview
// page, not the image bytes — both <img> and the server-side AI fetches fail
// on it. Idempotent: an already-direct URL is returned unchanged.
export function normalizeImageUrl(raw: string): string {
  const url = raw.trim();

  // Google Drive — pull the file ID out of any common link shape:
  //   /file/d/FILE_ID/view   ·   ?id=FILE_ID   ·   uc?id=FILE_ID
  if (/drive\.google\.com/i.test(url)) {
    const byPath = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const byQuery = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    const id = byPath?.[1] ?? byQuery?.[1] ?? '';
    // The thumbnail endpoint reliably serves the actual image (works in <img>
    // and for server-side fetches); sz=w2000 keeps it high-res for AI reference.
    if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w2000`;
  }

  // Dropbox — share links serve an HTML preview unless forced to raw bytes.
  if (/dropbox\.com/i.test(url)) {
    if (/[?&]dl=0/.test(url)) return url.replace(/([?&])dl=0/, '$1raw=1');
    if (!/[?&](raw|dl)=/.test(url)) return url + (url.includes('?') ? '&' : '?') + 'raw=1';
  }

  return url;
}

// A photo becomes either a data: URI (uploaded file) or its pasted URL,
// with cloud-share links normalized to a directly-fetchable image URL.
async function photoToImageUrl(photo: PetPhoto): Promise<string | null> {
  if (photo.file) return fileToDataUrl(photo.file);
  if (photo.url) return normalizeImageUrl(photo.url);
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
      payload.imageUrl = normalizeImageUrl(photo.url);
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

  // Skill Stage 2.3 — on a re-roll, embed the family's corrections in the prompt.
  const note = userNote?.trim();
  const refineList = (refinements ?? []).filter(Boolean).map((r) => r.replace(/_/g, ' '));
  const corrections =
    refineList.length || note
      ? `\n\nThe family reviewed a previous attempt and asked for corrections — apply these while keeping it unmistakably the same individual ${species}:${
          refineList.length ? ` adjust the ${refineList.join(', ')}.` : ''
        }${note ? ` ${note}` : ''}`
      : '';

  // Photo-led prompt: the breed name is deliberately NOT stated — naming a breed
  // makes the model generate a textbook breed example instead of THIS pet. The
  // reference photos are the source of truth for likeness.
  const prompt = `The attached reference photo(s) show ONE real, specific pet — an individual ${species} named ${petName}. Study them very closely.

Create a character reference sheet of THIS EXACT pet — the SAME individual animal in the photos, NOT a generic or idealized example of its breed. Faithfully reproduce ${petName}'s precise face and head shape, the exact ear shape and set, eye colour, spacing and expression, muzzle and nose, body build and proportions, and — above all — the EXACT colours, pattern and placement of its fur markings exactly as they appear in the photos. Someone who knows ${petName} must instantly recognise this as the same pet, not a look-alike.

Arrange four views in a 2x2 grid on a clean off-white background:
- Top left: front-facing portrait, head and shoulders, looking at the camera.
- Top right: three-quarter angle portrait, head and shoulders, relaxed expression.
- Bottom left: full side profile, full body, standing in a neutral pose.
- Bottom right: full body, sitting or lying down, alert and content.

It must be the same individual ${petName} in all four views, perfectly consistent with the photos and with each other. Soft natural studio lighting, realistic, warm, alive. No background scenery — clean off-white backdrop. No text, no labels, no watermarks. Do not invent a different animal and do not default to a stereotypical breed appearance.${corrections}`;

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
// Tribute card render. PRIMARY path: AI — one prompt (buildTributeCardPrompt,
// per the skill variable-reference) rendered via openai/gpt-image-2/edit with
// the character sheet as the pet-likeness reference. FALLBACK: the deterministic
// SVG renderer (/api/card/render), used when the character sheet or pet identity
// is missing, or if the AI render fails.

const CARD_EDIT_ASPECT: Record<AspectId, 'portrait_16_9' | 'landscape_16_9' | 'square_hd'> = {
  '9:16': 'portrait_16_9',
  '16:9': 'landscape_16_9',
  '1:1': 'square_hd',
  'all_three': 'portrait_16_9',
};

export interface CardPet {
  name: string;
  species: string;
  breedGuess?: string;
  coatDescription?: string;
  ageRange?: string;
}

// Deterministic SVG fallback — POSTs to /api/card/render (resvg-based).
async function renderCardImageSvg(opts: {
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

// AI path — single-prompt tribute card via openai/gpt-image-2/edit.
async function renderCardImageAI(opts: {
  kind: 'opening' | 'closing' | 'caption';
  text: string;
  characterSheet: string;
  containerId: ContainerId | null;
  themeId: ThemeId | null;
  styleId: ArtStyleId | null;
  aspect: AspectId;
  pet: CardPet;
  sceneHint?: string;
}): Promise<string | null> {
  const container = captionContainers.find((c) => c.id === opts.containerId);
  const prompt = buildTributeCardPrompt({
    cardType: opts.kind,
    resolvedCaption: opts.text,
    artStyle: opts.styleId ?? 'cinematic_realism',
    containerName: container?.name ?? 'caption banner',
    containerSpec: container?.spec ?? 'a soft cream caption banner in the lower third',
    petName: opts.pet.name,
    species: opts.pet.species,
    breedGuess: opts.pet.breedGuess,
    coatDescription: opts.pet.coatDescription,
    ageRange: opts.pet.ageRange,
    theme: opts.themeId ?? undefined,
    sceneHint: opts.sceneHint,
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120_000);
  try {
    const res = await fetch('/api/image/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        imageUrls: [opts.characterSheet],
        aspect: CARD_EDIT_ASPECT[opts.aspect] ?? 'portrait_16_9',
        quality: 'medium',
        outputFormat: 'png',
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
  pet?: CardPet;
  sceneHint?: string;
}): Promise<string | null> {
  // Skill path: AI render (pet + art style + container + resolved caption text).
  if (opts.characterSheet && opts.pet) {
    const ai = await renderCardImageAI({
      kind: opts.kind,
      text: opts.text,
      characterSheet: opts.characterSheet,
      containerId: opts.containerId,
      themeId: opts.themeId,
      styleId: opts.styleId,
      aspect: opts.aspect,
      pet: opts.pet,
      sceneHint: opts.sceneHint,
    });
    if (ai) return ai;
  }
  // Fallback: deterministic SVG renderer.
  return renderCardImageSvg({
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
  return renderCardImageSvg({
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

// ---- Narration script composition ------------------------------------------

// resolveText is not available client-side in this lib; replicate the minimal
// token substitution needed for the fallback (same tokens used in FinishedTribute).
function resolveFallbackTokens(text: string, petName: string, gender: string): string {
  const pronouns: Record<string, { subject: string; subjectCap: string }> = {
    male:    { subject: 'he',   subjectCap: 'He'   },
    female:  { subject: 'she',  subjectCap: 'She'  },
    neutral: { subject: 'they', subjectCap: 'They' },
  };
  const p = pronouns[gender] ?? pronouns['neutral'];
  return text
    .replace(/\[PET_NAME\]/g, petName)
    .replace(/\[PRONOUN_SUBJECT_CAP\]/g, p.subjectCap)
    .replace(/\[PRONOUN_SUBJECT\]/g, p.subject);
}

// Returns "was" or "were" depending on the subject pronoun (they → were).
function copula(subjectPronoun: string): string {
  return subjectPronoun === 'they' ? 'were' : 'was';
}

// Capitalizes the first character of a string.
function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Verbatim body of the previous composeNarration — preserved so behaviour can't regress.
function composeNarrationFallback(state: BuilderState): string {
  const name = state.petName || 'Them';
  const gender = state.gender ?? 'neutral';
  const relationship = state.relationship ?? 'unspecified';
  const relEntry = relationships.find((r) => r.id === relationship);
  const relLabel = relEntry?.narrationPhrase ?? (relationship === 'unspecified' ? 'a beloved companion' : relationship.replace(/_/g, ' '));
  const closingLine =
    state.cardText.closing ||
    resolveFallbackTokens('Forever loved. [PET_NAME] will always be with us.', name, gender);

  const pronouns: Record<string, { subject: string }> = {
    male:    { subject: 'he'   },
    female:  { subject: 'she'  },
    neutral: { subject: 'they' },
  };
  const subjectPronoun = (pronouns[gender] ?? pronouns['neutral']).subject;

  const parts: string[] = [];

  parts.push(
    capitalizeFirst(
      resolveFallbackTokens(
        `This is a tribute to [PET_NAME] — [PRONOUN_SUBJECT] ${copula(subjectPronoun)} ${relLabel}.`,
        name,
        gender,
      ),
    ),
  );

  if (state.traits.length > 0) {
    parts.push(
      capitalizeFirst(
        resolveFallbackTokens(`[PRONOUN_SUBJECT_CAP] ${copula(subjectPronoun)} ${state.traits.join(', ')}.`, name, gender),
      ),
    );
  }

  if (state.favorites.length > 0) {
    parts.push(capitalizeFirst(`${name} loved ${state.favorites.join(', ')}.`));
  }

  if (state.memoryPromptAnswer) {
    parts.push(
      capitalizeFirst(
        resolveFallbackTokens(
          `[PRONOUN_SUBJECT_CAP] ${copula(subjectPronoun)} the kind of ${relLabel} who ${state.memoryPromptAnswer}.`,
          name,
          gender,
        ),
      ),
    );
  }

  for (const line of state.words.narrationLetter) {
    if (line && line.trim()) {
      parts.push(capitalizeFirst(line.trim()));
    }
  }

  parts.push(capitalizeFirst(resolveFallbackTokens(closingLine, name, gender)));

  return parts.join(' ');
}

export async function composeNarrationScript(state: BuilderState): Promise<string> {
  const fallback = composeNarrationFallback(state);

  const name = state.petName || 'them';
  const gender = state.gender ?? 'neutral';
  const pronounsLabel =
    gender === 'male' ? 'he/him' : gender === 'female' ? 'she/her' : 'they/them';
  const relationship = state.relationship ?? 'unspecified';
  const relEntryForScript = relationships.find((r) => r.id === relationship);
  const relLabel =
    relationship === 'unspecified' ? '' : (relEntryForScript?.narrationPhrase ?? relationship.replace(/_/g, ' '));
  const years =
    state.yearsIncluded && state.years ? state.years : '';

  const answeredQA = (narrationQuestions as readonly string[])
    .map((q, i) => {
      const a = state.words.narrationLetter[i]?.trim();
      return a ? `Q: ${q}\nA: ${a}` : null;
    })
    .filter((x): x is string => x !== null)
    .join('\n\n');

  const beatLines = state.beatSheet
    .map((b, i) => `${i + 1}. ${b.name}: ${b.visual}`)
    .join('\n');

  // Narration length scales with the chosen tribute length so the voiceover
  // fits WITHIN the video. A script longer than the video makes compose pad a
  // frozen tail — e.g. a 200-word script on a 1-minute video overruns by ~35s.
  // ~100 words ≈ ~50s of gentle ElevenLabs speech at the current 0.82 speed.
  const wordsLow  = state.targetMinutes * 100;
  const wordsHigh = state.targetMinutes * 120;
  const wordsCap  = state.targetMinutes * 160;

  const prompt = `You are writing the voiceover narration for a memorial tribute video for a beloved pet. Write it in the FIRST PERSON, as if spoken aloud by the pet's owner — warm, intimate, and personal, never generic.

THE PET
Name: ${name}
Pronouns: ${pronounsLabel}${relLabel ? `\nRelationship to the owner: ${relLabel}` : ''}${years ? `\nYears: ${years}` : ''}${state.traits.length > 0 ? `\nWhat they were like: ${state.traits.join(', ')}` : ''}${state.favorites.length > 0 ? `\nThings they loved: ${state.favorites.join(', ')}` : ''}${state.memoryPromptAnswer ? `\nA treasured memory from the owner: ${state.memoryPromptAnswer}` : ''}

WHAT THE OWNER TOLD US
${answeredQA || '(no answers provided)'}

THE VIDEO'S EMOTIONAL ARC (the narration must follow this order of beats)
${beatLines || '(no beat sheet yet)'}

THE OPENING TITLE CARD READS: "${state.cardText.opening}"
THE CLOSING TITLE CARD READS: "${state.cardText.closing}"

INSTRUCTIONS
- Write ONE continuous narration script, ${wordsLow} to ${wordsHigh} words. This is critical — it must fit comfortably WITHIN a roughly ${state.targetMinutes}-minute video at a gentle, unhurried pace, and must NOT run longer.
- Follow the emotional arc of the beats above, from the opening to the close.
- Speak as the owner, to or about ${name}. Use the correct pronouns.
- Use the owner's own details — the memory, the traits, the things ${name} loved. Weave them in naturally; do not list them.
- Write with natural punctuation for spoken delivery: commas, ellipses, and short sentences, so the voice can breathe and pause. Avoid long run-ons.
- Gentle, loving, and honest. Tender, not saccharine. No clichés like "rainbow bridge" unless the owner used that language themselves.
- Do NOT mention illness, injury, or how the pet died.
- Output ONLY the narration text. No title, no headings, no quotation marks, no stage directions, no word count.`;

  const out = await generateText(prompt);
  if (!out) return fallback;

  const wordCount = out.trim().split(/\s+/).length;
  if (wordCount < 60) return fallback;

  // Sanitize: strip markdown fences, leading label, collapse whitespace, cap at 280 words.
  let clean = out
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#+\s+/gm, '')
    .replace(/^\*{1,2}(.*?)\*{1,2}$/gm, '$1')
    .replace(/^_+(.*?)_+$/gm, '$1')
    .replace(/^(?:Narration|Voiceover|Script)\s*:\s*/i, '')
    .replace(/^["']/,'').replace(/["']$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Hard-cap on a word boundary — scales with tribute length so a runaway
  // generation can't overrun the video.
  const words = clean.split(' ');
  if (words.length > wordsCap) {
    clean = words.slice(0, wordsCap).join(' ');
    // End at the last sentence boundary if possible.
    const lastPeriod = clean.lastIndexOf('.');
    if (lastPeriod > clean.length * 0.6) clean = clean.slice(0, lastPeriod + 1);
  }

  return clean || fallback;
}

export async function pollBeatVideo(
  endpoint: string,
  requestId: string,
  beatIndex?: number,
): Promise<{ status: string; url?: string } | null> {
  try {
    const indexParam = beatIndex != null ? `&beatIndex=${beatIndex}` : '';
    const res = await fetch(
      `/api/video/status?endpoint=${encodeURIComponent(endpoint)}&requestId=${encodeURIComponent(requestId)}${indexParam}`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { status?: string; url?: string };
    if (!json.status) return null;
    return { status: json.status, url: json.url };
  } catch {
    return null;
  }
}
