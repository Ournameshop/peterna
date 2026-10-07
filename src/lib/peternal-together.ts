// peternal-together.ts — beat sheet generator for the "Owner & Pet — Together"
// storyline (NEXT_PUBLIC_TOGETHER_FLOW). Sibling to peternal-beatsheet.ts, but a
// separate, dedicated generator: existing generateBeatSheet is untouched, and its
// output stays byte-identical for the pet-only flow.
//
// Reuses beatStructures[beatCount] so the archetype sequence works unchanged.
// The narrative is fixed (no reorder, no theme/format branching) — this is a
// single locked storyline, not a configurable one.

import type { Beat } from '@/app/builder/state';
import type { BeatArchetype, Gender } from '@/lib/peternal-library';
import { beatStructures } from '@/lib/peternal-library';

export interface TogetherGenerateInput {
  beatCount: 3 | 8 | 12 | 16;
  gender: Gender;
  petName: string;
  ownerName: string;          // state.creatorName; '' → "their person"
  memoryPromptAnswer: string; // woven into ONE memory slot if present
}

// Enforce <= 15 words; truncate at word boundary if needed.
// (Local copy of the peternal-beatsheet.ts pattern — deliberately not imported
// from there, per spec.)
function enforceCaption(text: string): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= 15) return text.trim();
  return words.slice(0, 15).join(' ');
}

// Per-archetype-slot visual generators — deterministic by occurrence index of
// each archetype in the arc. Always phrased "${owner} and ${petName} together".
function visualForOpen(owner: string, petName: string): string {
  return `${owner} and ${petName} together at home in soft morning light — ${petName} settled close beside them, two lives shared in one quiet frame`;
}

function visualForMemory(subIndex: number, owner: string, petName: string): string {
  const steps = [
    `The door opens and ${petName} rushes to greet ${owner} — pure joy of reunion, heart in motion, ${owner} kneeling into the welcome`,
    `${owner} and ${petName} on the couch in warm lamplight — ${petName} leaning into them, an ordinary evening made precious`,
    `${owner} and ${petName} on a wide sunlit beach — walking the waterline together, wind and light, ${petName} splashing ahead and circling back to them`,
    `${owner} and ${petName} playing together in golden light — a favorite game between them, laughter and motion, eyes finding each other mid-play`,
    `${owner} and ${petName} on a slow evening walk down the familiar path — side by side, unhurried, the easy silence of true companions`,
  ];
  return steps[Math.min(subIndex, steps.length - 1)];
}

const MEMORY_CAPTIONS = [
  'Every homecoming was a celebration.',
  "We didn't need words for evenings like these.",
  'The best days were the ones we spent side by side.',
  'Joy was a game we played together.',
  'We walked each other home, every single day.',
];

function visualForConnection(subIndex: number, owner: string, petName: string): string {
  const steps = [
    `${owner}'s hand resting gently on ${petName}'s head — ${petName} looking up at them, that familiar gaze passing between the two`,
    `${owner} and ${petName} silhouetted together at the window in soft light — simply keeping each other company`,
  ];
  return steps[Math.min(subIndex, steps.length - 1)];
}

const CONNECTION_CAPTIONS = [
  'One look was all we ever needed.',
  'Just being near each other was enough.',
];

function visualForCeremonial(subIndex: number, owner: string, petName: string): string {
  const steps = [
    `The last walk begins — ${owner} and ${petName} side by side on the familiar path, golden light ahead`,
    `${owner} kneels to ${petName}, forehead to forehead — a whole lifetime held in one gentle pause`,
    `The embrace — ${owner} holding ${petName} close, unhurried and at peace`,
    `${owner} stands at a threshold of soft light as ${petName} steps gently forward — a farewell without fear`,
  ];
  return steps[Math.min(subIndex, steps.length - 1)];
}

const CEREMONIAL_CAPTIONS = [
  'We took the last walk together, slowly.',
  'I held you the way you always held me.',
  'Peace, together.',
  'You knew the way.',
];

function visualForRelease(subIndex: number, owner: string, petName: string): string {
  const steps = [
    `A last glance between them — ${petName} looking back at ${owner}, soft eyes meeting one final time`,
    `${petName} running freely into open light while ${owner} watches with a peaceful, loving smile`,
    `${owner} standing in the warm light, ${petName}'s presence still beside them — together in spirit`,
  ];
  return steps[Math.min(subIndex, steps.length - 1)];
}

const RELEASE_CAPTIONS = [
  'You ran ahead, the way you always did.',
  'Free, and still mine.',
  'Still beside me.',
];

function visualForClose(owner: string, petName: string): string {
  return `${owner} and ${petName} together one last time in soft light — the embrace of a lifetime, peaceful and whole`;
}

// Human-readable beat names by archetype — clamped to the last entry when an
// arc has more occurrences than named variants (mirrors ARCHETYPE_NAMES in
// peternal-beatsheet.ts).
const TOGETHER_ARCHETYPE_NAMES: Record<BeatArchetype, string[]> = {
  open:       ['Together at Home'],
  memory:     ['The Door Greeting', 'Evenings Together', 'The Beach', 'Play', 'The Quiet Walk'],
  connection: ['That Look'],
  ceremonial: ['The Last Walk', 'The Embrace'],
  release:    ['Running Free'],
  close:      ['Together, Always'],
};

export function generateTogetherBeatSheet(input: TogetherGenerateInput): Beat[] {
  const { beatCount, gender, petName, ownerName, memoryPromptAnswer } = input;
  void gender; // unused — kept for signature parity with generateBeatSheet's input shape

  const owner = ownerName || 'their person';
  const arc: readonly BeatArchetype[] = beatStructures[beatCount];

  let memoryIndex = 0;
  let connectionIndex = 0;
  let ceremonialIndex = 0;
  let releaseIndex = 0;
  let usedMemoryPrompt = false;

  const beats: Beat[] = arc.map((archetype, i) => {
    let visual = '';
    let caption = '';
    let spokenOrTitle = '';

    switch (archetype) {
      case 'open': {
        visual = visualForOpen(owner, petName);
        caption = petName;
        spokenOrTitle = petName;
        break;
      }
      case 'memory': {
        const subIndex = memoryIndex;
        // memoryPromptAnswer, if present, replaces memory[1]'s visual only.
        if (subIndex === 1 && !usedMemoryPrompt && memoryPromptAnswer) {
          visual = `${owner} and ${petName} together: ${memoryPromptAnswer}`;
          usedMemoryPrompt = true;
        } else {
          visual = visualForMemory(subIndex, owner, petName);
        }
        caption = MEMORY_CAPTIONS[Math.min(subIndex, MEMORY_CAPTIONS.length - 1)];
        memoryIndex++;
        break;
      }
      case 'connection': {
        visual = visualForConnection(connectionIndex, owner, petName);
        caption = CONNECTION_CAPTIONS[Math.min(connectionIndex, CONNECTION_CAPTIONS.length - 1)];
        connectionIndex++;
        break;
      }
      case 'ceremonial': {
        visual = visualForCeremonial(ceremonialIndex, owner, petName);
        caption = CEREMONIAL_CAPTIONS[Math.min(ceremonialIndex, CEREMONIAL_CAPTIONS.length - 1)];
        ceremonialIndex++;
        break;
      }
      case 'release': {
        visual = visualForRelease(releaseIndex, owner, petName);
        caption = RELEASE_CAPTIONS[Math.min(releaseIndex, RELEASE_CAPTIONS.length - 1)];
        releaseIndex++;
        break;
      }
      case 'close': {
        visual = visualForClose(owner, petName);
        caption = 'Together, always.';
        spokenOrTitle = petName;
        break;
      }
      default: {
        visual = '';
        caption = '';
      }
    }

    // Occurrence index of this archetype within the arc, for name lookup.
    const archetypeNames = TOGETHER_ARCHETYPE_NAMES[archetype];
    const archetypeNameIdx = (() => {
      let count = 0;
      for (let j = 0; j < i; j++) { if (arc[j] === archetype) count++; }
      return count;
    })();
    const name = archetypeNames[Math.min(archetypeNameIdx, archetypeNames.length - 1)];

    return {
      index: i,
      archetype,
      name,
      visual,
      caption: enforceCaption(caption),
      spokenOrTitle,
      lengthSeconds: 15,
    };
  });

  return beats;
}
