import type { Beat } from '@/app/builder/state';
import type {
  BeatArchetype,
  FormatId,
  ThemeId,
  Gender,
} from '@/lib/peternal-library';
import { beatStructures, favoriteThings, personalityTraits, themes, captionTemplates } from '@/lib/peternal-library';
import { resolveText } from '@/lib/peternal-resolvers';

type GenerateInput = {
  beatCount: 8 | 12 | 16;
  format: FormatId;
  theme: ThemeId;
  gender: Gender;
  petName: string;
  favorites: string[];
  memoryPromptAnswer: string;
  traits: string[];
};

// Per-archetype visual description generators — deterministic, no randomness.
function visualForMemory(sceneHint: string): string {
  return sceneHint;
}

function visualForConnection(): string {
  return 'The pet at rest, looking directly at the viewer — that familiar gaze, the quiet bond in those eyes';
}

function visualForCeremonial(subIndex: number, themeDescription: string): string {
  const steps = [
    `The threshold: a soft opening in the world, warm light beyond — ${themeDescription.split('.')[0]}`,
    `The first step: gentle movement forward into the light`,
    `The crossing: the pet walking gracefully toward the horizon`,
    `The archway: a final passage through soft golden light`,
  ];
  return steps[Math.min(subIndex, steps.length - 1)];
}

function visualForRelease(subIndex: number): string {
  const phases = [
    'A glance back — soft eyes meeting the viewer one last time, unhurried',
    'Joyful release: running freely through open light, pure and unburdened',
    'Among the stars: resting in soft celestial light, peaceful and whole',
  ];
  return phases[Math.min(subIndex, phases.length - 1)];
}

function visualForOpen(petName: string): string {
  return `${petName} at rest in soft light, a calm establishing shot as the tribute begins`;
}

function visualForClose(petName: string): string {
  return `${petName} peaceful and whole, a gentle final shot as the tribute closes`;
}

// Pick caption template key based on scene-hint content
function captionKeyForSceneHint(hint: string): string {
  if (/sunbeam|morning light|sun/.test(hint)) return 'sunbeam';
  if (/toy|play|fetch/.test(hint)) return 'favorite_toy';
  if (/car|window|ride/.test(hint)) return 'car_ride';
  if (/window|watch|patrol|quiet|shadow/.test(hint)) return 'quiet_pause';
  return 'sunbeam';
}

// Enforce <= 15 words; truncate at word boundary if needed.
function enforceCaption(text: string): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= 15) return text.trim();
  return words.slice(0, 15).join(' ');
}

// Resolve one caption from a template key, with gender substitution.
// variantIndex selects which template variant to use (mod bucket length).
function resolveCaptionFromKey(
  key: string,
  gender: Gender,
  petName: string,
  variantIndex: number,
  traitAdj?: string
): string {
  const bucket = captionTemplates[key];
  if (!bucket || bucket.length === 0) return '';
  const raw = resolveText(bucket[variantIndex % bucket.length], { gender, petName, traitAdj });
  return enforceCaption(raw);
}

// Format overrides — rename beat or spokenOrTitle per format.
function applyFormatOverride(
  beat: Beat,
  format: FormatId,
  arcIndex: number,        // position in the archetype sequence for this format
  totalBeats: number,
  letterLineIndex: { count: number }  // mutable ref for letter line numbering
): Beat {
  const b = { ...beat };

  switch (format) {
    case 'music_video': {
      // verse/chorus naming: 8=V-C-V-C, 12=V-C-B-V-C-B-V-C-..., 16=2nd bridge+outro
      const musicStructure8 = ['Intro', 'Verse 1', 'Chorus', 'Verse 2', 'Chorus', 'Bridge', 'Final Chorus', 'Outro'];
      const musicStructure12 = ['Intro', 'Verse 1', 'Chorus 1', 'Verse 2', 'Chorus 2', 'Bridge', 'Verse 3', 'Chorus 3', 'Verse 4', 'Chorus 4', 'Final Chorus', 'Outro'];
      const musicStructure16 = ['Intro', 'Verse 1', 'Chorus 1', 'Verse 2', 'Chorus 2', 'Bridge 1', 'Verse 3', 'Chorus 3', 'Bridge 2', 'Verse 4', 'Chorus 4', 'Verse 5', 'Chorus 5', 'Outro Bridge', 'Final Chorus', 'Outro'];
      const map = totalBeats === 8 ? musicStructure8 : totalBeats === 12 ? musicStructure12 : musicStructure16;
      b.name = map[arcIndex] ?? b.name;
      break;
    }
    case 'biopic': {
      // Chronological life-stage naming for memory beats
      const stages = ['Puppyhood', 'Growing Up', 'Young & Bold', 'In Their Prime', 'Golden Years'];
      if (b.archetype === 'memory') {
        const memIdx = arcIndex - 1; // offset past open beat
        b.name = stages[Math.min(memIdx, stages.length - 1)] ?? b.name;
      }
      break;
    }
    case 'letter': {
      // Each beat's spokenOrTitle carries a letter line
      const lineNum = letterLineIndex.count + 1;
      letterLineIndex.count = lineNum;
      if (b.archetype === 'open') {
        b.spokenOrTitle = 'Dear one,';
      } else if (b.archetype === 'close') {
        b.spokenOrTitle = 'With all my love, always.';
      } else {
        b.spokenOrTitle = `[Letter line ${lineNum}]`;
      }
      break;
    }
    case 'postcards': {
      // Each beat is a location postcard
      const locations = [
        'Home', 'The favorite park', 'That sunny corner', 'The old trail', 'The backyard at dusk',
        'A golden meadow', 'The beach', 'Somewhere warm', 'A hilltop', 'The old path',
        'A meadow of light', 'By the water', 'Somewhere you loved', 'A quiet garden',
        'The horizon', 'Where the light is warm',
      ];
      b.spokenOrTitle = locations[arcIndex] ?? `Postcard from scene ${arcIndex + 1}`;
      break;
    }
    case 'greatest_hits': {
      // No ceremonial section — memory beats expand to fill; release becomes montage close
      if (b.archetype === 'ceremonial') {
        b.name = `Highlight — ${b.name}`;
      }
      if (b.archetype === 'release') {
        b.name = 'Montage Close';
      }
      break;
    }
    default:
      break;
  }

  return b;
}

export function generateBeatSheet(input: GenerateInput): Beat[] {
  const { beatCount, format, theme, gender, petName, favorites, memoryPromptAnswer, traits } = input;

  // Step 1: read arc template
  const arc: readonly BeatArchetype[] = beatStructures[beatCount];

  // Step 2: prepare scene-hint queue from favoriteThings
  const hintQueue: string[] = favorites
    .map((favId) => favoriteThings.find((f) => f.id === favId)?.sceneHint ?? '')
    .filter(Boolean);

  // memoryPromptAnswer occupies one memory slot if present
  let usedMemoryPrompt = false;
  let hintIndex = 0;
  let memoryIndex = 0;
  let connectionIndex = 0;
  let ceremonialIndex = 0;
  let releaseIndex = 0;

  const themeObj = themes.find((t) => t.id === theme);
  const themeDescription = themeObj?.desc ?? '';

  // Pet name used count guard — name may appear at most once across the sheet.
  // We place it on beat 0 (open) only.
  let petNameUsed = false;

  // Resolve first trait to an adjective_tag for template placeholders
  const traitAdj = traits.length > 0
    ? (personalityTraits.find((t) => t.id === traits[0])?.adjectiveTag ?? traits[0])
    : undefined;

  const letterLineRef = { count: 0 };

  const beats: Beat[] = arc.map((archetype, i) => {
    let visual = '';
    let caption = '';
    let spokenOrTitle = '';
    let sceneHintSource: string | undefined;

    switch (archetype) {
      case 'open': {
        visual = visualForOpen(petName);
        caption = petNameUsed ? '' : petName;
        spokenOrTitle = petName;
        petNameUsed = true;
        break;
      }
      case 'memory': {
        let hint = '';
        if (!usedMemoryPrompt && memoryPromptAnswer) {
          hint = memoryPromptAnswer;
          usedMemoryPrompt = true;
          sceneHintSource = 'memory_prompt';
        } else if (hintIndex < hintQueue.length) {
          hint = hintQueue[hintIndex];
          sceneHintSource = favorites[hintIndex] ?? undefined;
          hintIndex++;
        } else {
          hint = 'A quiet, beloved moment — the kind only they could bring';
          sceneHintSource = undefined;
        }
        visual = visualForMemory(hint);
        const cKey = captionKeyForSceneHint(hint);
        caption = enforceCaption(
          resolveText(
            captionTemplates[cKey]?.[memoryIndex % (captionTemplates[cKey]?.length || 1)] ?? '',
            { gender, petName: '', traitAdj }
          )
        );
        spokenOrTitle = '';
        memoryIndex++;
        break;
      }
      case 'connection': {
        visual = visualForConnection();
        caption = resolveCaptionFromKey('familiar_gaze', gender, '', connectionIndex, traitAdj);
        spokenOrTitle = '';
        connectionIndex++;
        break;
      }
      case 'ceremonial': {
        visual = visualForCeremonial(ceremonialIndex, themeDescription);
        caption = resolveCaptionFromKey('threshold', gender, '', ceremonialIndex, traitAdj);
        spokenOrTitle = '';
        ceremonialIndex++;
        break;
      }
      case 'release': {
        visual = visualForRelease(releaseIndex);
        if (releaseIndex === 0) {
          caption = resolveCaptionFromKey('glance_back', gender, '', releaseIndex, traitAdj);
        } else {
          caption = resolveCaptionFromKey('joyful_release', gender, '', releaseIndex - 1, traitAdj);
        }
        spokenOrTitle = '';
        releaseIndex++;
        break;
      }
      case 'close': {
        visual = visualForClose(petName);
        // Closing caption uses glance_back key as the closing line
        caption = resolveCaptionFromKey('glance_back', gender, '', releaseIndex, traitAdj);
        spokenOrTitle = petName;
        break;
      }
      default: {
        visual = '';
        caption = '';
        spokenOrTitle = '';
      }
    }

    const rawBeat: Beat = {
      index: i,
      archetype,
      name: `${archetype.charAt(0).toUpperCase()}${archetype.slice(1)} ${i + 1}`,
      visual,
      caption: enforceCaption(caption),
      spokenOrTitle,
      sceneHintSource,
      lengthSeconds: 15,
    };

    return applyFormatOverride(rawBeat, format, i, beatCount, letterLineRef);
  });

  // Step 5 — pet name appears at most 1× across all captions (already guarded above by petNameUsed).
  // Final enforcement pass: if any caption beyond beat 0 contains the pet name, strip it.
  for (let i = 1; i < beats.length; i++) {
    if (petName && beats[i].caption.includes(petName)) {
      // split/join, not RegExp(petName) — pet names can contain regex metacharacters.
      beats[i] = { ...beats[i], caption: beats[i].caption.split(petName).join('') };
    }
  }

  // Step 5 continued — beat 0 caption IS the opening line, last beat caption IS the closing line.
  // The open beat already has petName as caption. The close beat has the glance_back caption.
  // This is already satisfied above.

  // Step 6 — reorder memory beats youngest-to-oldest so the arc reads as a
  // natural life progression. Score 0 = early life, 1 = mid, 2 = late/quiet.
  // All non-memory beats stay fixed in place.
  function memoryLifeScore(visual: string): number {
    const v = visual.toLowerCase();
    if (/puppy|kitten|young|pup|play.bow|fetch|toy|sock|snow|bound|leap|mischiev|first/.test(v)) return 0;
    if (/sunbeam|nap|curl|couch|window|patrol|golden hour|sunset/.test(v)) return 2;
    return 1;
  }

  const memoryIndices = beats
    .map((b, i) => (b.archetype === 'memory' ? i : -1))
    .filter((i) => i !== -1);

  if (memoryIndices.length > 1) {
    const memoryBeats = memoryIndices.map((i) => beats[i]);
    memoryBeats.sort((a, b) => memoryLifeScore(a.visual) - memoryLifeScore(b.visual));
    memoryIndices.forEach((pos, slot) => {
      beats[pos] = { ...memoryBeats[slot], index: pos };
    });
  }

  return beats;
}
