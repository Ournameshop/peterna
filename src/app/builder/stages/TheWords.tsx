"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Play, RefreshCw, Sparkles, Upload } from 'lucide-react';
import { PALETTE } from '../lib/palette';
import {
  StageShell,
  GateReview,
  Serif,
  Sans,
  Eyebrow,
  FieldGroup,
  SummaryItem,
  SELECTED_BORDER,
  SELECTED_RING,
} from '../lib/primitives';
import { Waveform } from '../art';
import { useBuilder, usePreviewMode } from '../state';
import type { BuilderState, MusicMode, MusicProvider, MusicVariant } from '../state';
import type { StageProps } from './types';
import {
  openingArchetypes,
  closingArchetypes,
  captionTemplates,
  narrationVoices,
  narrationQuestions,
  personalityTraits,
  favoriteThings,
  relationships,
  themes,
  formats,
  artStyles,
} from '@/lib/peternal-library';
import { resolveArchetype, resolveText, musicTracksFor, captionVoiceFor } from '@/lib/peternal-resolvers';
import { buildInstrumentalPrompt } from '@/lib/music-prompts';
import { computeTributeAudioSeconds } from '../lib/tribute-duration';
import { generateText } from '../lib/generation';

const NARRATION_QUESTIONS = narrationQuestions;
const PREVIEW_AUDIO_URL =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';
const WORDS_HASH_TO_SUB: Record<string, number> = {
  '#words-opening': 0,
  '#words-closing': 1,
  '#words-captions': 2,
  '#words-music': 3,
  '#words-narration': 4,
  '#words-review': 5,
};

const SUB_STEPS = ['Opening', 'Closing', 'Captions', 'Music', 'Narration', 'Review'];

function groupBy<T>(arr: readonly T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

function cleanSongText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function listText(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function labelFromIds(ids: string[], source: readonly { id: string; label?: string; name?: string }[]): string[] {
  return ids.map((id) => {
    const found = source.find((item) => item.id === id);
    return found?.label ?? found?.name ?? id.replace(/_/g, ' ');
  });
}

function safeTitle(name: string): string {
  return `For ${name || 'You'}`.slice(0, 80);
}

function defaultMusicStyle(state: BuilderState): string {
  const themeObj = themes.find((t) => t.id === state.theme);
  const styleObj = artStyles.find((s) => s.id === state.style);
  const styleName = styleObj?.name ?? (state.style ? state.style.replace(/_/g, ' ') : 'cinematic realism');
  const themeName = themeObj?.name ?? 'gentle memorial';
  return `gentle memorial ballad, ${themeName.toLowerCase()}, ${styleName}, warm piano, soft strings, intimate vocal`;
}


function songDurationLabel(state: BuilderState): string {
  return `${state.targetMinutes}:00`;
}

function fmtMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function lyricLengthInstruction(state: BuilderState): string {
  const beatCount = state.beatSheet.length || state.beatCount;
  switch (state.targetMinutes) {
    case 1:
      return `Target length: about 1:00. Uses ${beatCount} beat-card lines, one short chorus, and no extended outro.`;
    case 2:
      return `Target length: about 2:00. Uses ${beatCount} beat-card lines, two compact choruses, and a short bridge.`;
    case 3:
      return `Target length: about 3:00. Uses ${beatCount} beat-card lines, verse/chorus/verse/bridge/final chorus structure.`;
    case 4:
      return `Target length: about 4:00. Uses ${beatCount} beat-card lines, expanded verses, bridge, and a clean final refrain.`;
  }
}

function lyricTargetWords(state: BuilderState): { min: number; max: number } {
  switch (state.targetMinutes) {
    case 1: return { min: 70, max: 105 };
    case 2: return { min: 120, max: 170 };
    case 3: return { min: 190, max: 260 };
    case 4: return { min: 260, max: 360 };
  }
}

// The max video length the system can actually render: each Seedance clip is
// capped at 15s, so beatCount*15 + cards is the ceiling. The song must not run
// longer than this, or the video would freeze-pad / the song would get cut off.
function maxVideoSeconds(state: BuilderState): number {
  const captionCardCount = state.words.captions.length;
  const cardsSeconds = 6 + captionCardCount * 2.5;
  return Math.round(state.beatCount * 15 + cardsSeconds);
}

// Hard cap on sung words, derived from the max video length (~1.4 words/sec),
// so the generated lyrics — and therefore the song — can't exceed the video.
function lyricMaxWords(state: BuilderState): number {
  return Math.round(maxVideoSeconds(state) * 1.4);
}

// Truncate lyric text to a word cap, keeping whole lines (preserves structure).
function capLyricWords(text: string, maxWords: number): string {
  if (text.split(/\s+/).filter(Boolean).length <= maxWords) return text;
  const kept: string[] = [];
  let words = 0;
  for (const line of text.split('\n')) {
    const lw = line.split(/\s+/).filter(Boolean).length;
    if (words + lw > maxWords && words > 0) break;
    kept.push(line);
    words += lw;
  }
  return kept.join('\n').trimEnd();
}

function lyricCleanLine(value: string, maxWords = 12): string {
  const clean = cleanSongText(value)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[.!?]+$/g, '');
  const words = clean.split(' ').filter(Boolean);
  if (words.length <= maxWords) return clean;
  return words.slice(0, maxWords).join(' ');
}

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>();
  return lines
    .map((line) => lyricCleanLine(line))
    .filter((line) => {
      if (!line) return false;
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function beatLyricLines(state: BuilderState): string[] {
  const beats = state.beatSheet.length
    ? state.beatSheet
    : Array.from({ length: state.beatCount }, (_, index) => ({
        index,
        caption: '',
        spokenOrTitle: '',
        name: `Beat ${index + 1}`,
        visual: '',
      }));

  return uniqueLines(beats.map((beat) => {
    const userCaption = state.words.captions.find((c) => c.beatIndex === beat.index)?.text;
    return userCaption || beat.spokenOrTitle || beat.caption || beat.name || beat.visual;
  }));
}

function beatSceneLines(state: BuilderState): string[] {
  return uniqueLines(
    state.beatSheet
      .map((beat) => beat.visual || beat.name || beat.caption)
      .filter(Boolean),
  ).slice(0, Math.max(2, Math.min(6, state.targetMinutes + 2)));
}

function splitForSong<T>(items: T[], parts: number): T[][] {
  const result: T[][] = Array.from({ length: parts }, () => []);
  items.forEach((item, idx) => {
    result[Math.min(parts - 1, Math.floor((idx / Math.max(1, items.length)) * parts))].push(item);
  });
  return result;
}

function section(title: string, lines: string[]): string {
  return [`[${title}]`, ...lines.filter(Boolean)].join('\n');
}

function buildSongBrief(state: BuilderState): string {
  const petName = state.petName || 'this beloved pet';
  const themeObj = themes.find((t) => t.id === state.theme);
  const formatObj = formats.find((f) => f.id === state.format);
  const styleObj = artStyles.find((s) => s.id === state.style);
  const relEntry = relationships.find((r) => r.id === state.relationship);
  const wordTarget = lyricTargetWords(state);
  const beatLines = beatLyricLines(state);

  return [
    `Tribute song for ${petName}.`,
    `Video length: ${songDurationLabel(state)} (${state.beatCount} planned beats).`,
    `Lyric length: aim for ${wordTarget.min}-${lyricMaxWords(state)} sung words. HARD MAX ${lyricMaxWords(state)} words — never exceed it.`,
    formatObj ? `Format: ${formatObj.name} - ${formatObj.desc}` : null,
    themeObj ? `Theme: ${themeObj.name} - ${themeObj.desc}` : null,
    styleObj ? `Visual style: ${styleObj.name}.` : null,
    relEntry ? `Relationship: ${relEntry.narrationPhrase}; tone ${relEntry.narrationTone.replace(/_/g, ' ')}.` : null,
    `Beat-card source lines: ${beatLines.join(' / ')}.`,
    `Do not add extra verses beyond the provided lyrics. The finished song MUST end within ${songDurationLabel(state)} and must NOT run longer than the video.`,
  ].filter(Boolean).join(' ');
}

function buildLyricDraft(state: BuilderState, openingText: string, closingText: string): string {
  const petName = state.petName || 'you';
  const traitLabels = labelFromIds(state.traits, personalityTraits);
  const favoriteLabels = labelFromIds(state.favorites, favoriteThings);
  const relEntry = relationships.find((r) => r.id === state.relationship);
  const relPhrase = relEntry?.narrationPhrase ?? 'my beloved friend';
  const beatLines = beatLyricLines(state);
  const sceneLines = beatSceneLines(state);
  const [firstBeats, middleBeats, finalBeats] = splitForSong(beatLines, 3);
  const favoriteLine = favoriteLabels.length ? `You loved ${listText(favoriteLabels)}` : '';
  const traitLine = traitLabels.length ? `You were ${listText(traitLabels)}` : '';
  const memoryLine = state.memoryPromptAnswer
    ? cleanSongText(state.memoryPromptAnswer)
    : `the little look that always brought me home`;
  const close = closingText && closingText !== '—'
    ? lyricCleanLine(closingText, 14)
    : `Forever loved, ${petName}`;
  const open = openingText && openingText !== '—'
    ? lyricCleanLine(openingText, 14)
    : petName;

  const chorus = [
    `${petName}, you are still here with me`,
    'In every room, in every memory',
    state.targetMinutes >= 2 ? 'Every little moment still knows your name' : null,
    state.targetMinutes >= 3 ? 'Love does not leave when the light has changed' : null,
  ].filter(Boolean) as string[];

  const verseOne = uniqueLines([
    open,
    `You were ${relPhrase}, walking softly through my life`,
    traitLine,
    ...firstBeats,
  ]);
  const verseTwo = uniqueLines([
    favoriteLine,
    `I still remember ${lyricCleanLine(memoryLine, 12)}`,
    ...middleBeats,
    ...(state.targetMinutes >= 3 ? sceneLines.slice(0, 2) : []),
  ]);
  const bridge = uniqueLines([
    ...finalBeats,
    ...(state.targetMinutes >= 3 ? sceneLines.slice(2, 5) : []),
    'No last day can take away',
    'The life you gave, the love that stays',
  ]);
  const outro = uniqueLines([
    ...(state.targetMinutes >= 2 ? chorus.slice(0, state.targetMinutes >= 3 ? 4 : 3) : []),
    'I will carry what you gave',
    close,
  ]);

  const sections = state.targetMinutes === 1
    ? [
        section('Verse', uniqueLines([...verseOne, ...verseTwo.slice(0, 2)])),
        section('Chorus', chorus.slice(0, 2)),
        section('Outro', uniqueLines([...bridge.slice(0, 2), close])),
      ]
    : [
        section('Verse 1', verseOne),
        section('Chorus', chorus.slice(0, state.targetMinutes >= 3 ? 4 : 3)),
        section('Verse 2', verseTwo),
        section(state.targetMinutes >= 3 ? 'Bridge' : 'Short Bridge', bridge),
        section('Final Chorus', outro),
      ];

  return capLyricWords(sections.join('\n\n'), lyricMaxWords(state));
}

function buildLyricLLMPrompt(state: BuilderState): string {
  const petName = state.petName || 'this beloved pet';
  const maxSec = maxVideoSeconds(state);
  const maxWords = lyricMaxWords(state);
  const beatCount = state.beatSheet.length || state.beatCount;
  const captionCardCount = state.words.captions.length;
  const cardsSeconds = 6 + captionCardCount * 2.5;
  const perBeatSec = Math.round(Math.min(15, Math.max(4, (maxSec - cardsSeconds) / Math.max(1, beatCount))));

  const relEntry = relationships.find((r) => r.id === state.relationship);
  const relPhrase = relEntry?.narrationPhrase ?? 'my beloved companion';
  const traitLabels = labelFromIds(state.traits, personalityTraits);
  const favoriteLabels = labelFromIds(state.favorites, favoriteThings);
  const species = state.petProfile?.species ?? 'pet';

  const beatList = (
    state.beatSheet.length
      ? state.beatSheet
      : Array.from({ length: beatCount }, (_, i) => ({ index: i, name: `Scene ${i + 1}`, visual: '', caption: '', spokenOrTitle: '' }))
  )
    .map((beat, i) => {
      const desc = beat.visual || beat.caption || beat.spokenOrTitle || beat.name;
      return `${i + 1}. ${beat.name} (~${perBeatSec}s): ${desc}`;
    })
    .join('\n');

  const lines: string[] = [
    `You are writing complete, singable memorial song lyrics for a tribute to ${petName}, a ${species}.`,
    '',
    `LENGTH: Write COMPLETE, natural song lyrics for a song that runs about ${maxSec} seconds — about ${maxWords} sung words total. Natural and complete, NOT cut off. Do not exceed the word budget.`,
    '',
    `PET CONTEXT:`,
    `- Name: ${petName}`,
    `- Species: ${species}`,
    relEntry ? `- Relationship to owner: ${relPhrase}` : '',
    traitLabels.length ? `- Personality: ${traitLabels.join(', ')}` : '',
    favoriteLabels.length ? `- Loved: ${listText(favoriteLabels)}` : '',
    state.memoryPromptAnswer ? `- A treasured memory: ${state.memoryPromptAnswer}` : '',
    '',
    `SCENES (follow in this order — one short lyric section per scene or per pair of scenes, so the words match what is on screen at that moment):`,
    beatList,
    '',
    `TONE: Warm, gentle, memorial. Singable and natural. No mention of death, illness, last day, gravestones, or illness. Output ONLY the lyrics with at most [Verse], [Chorus], [Bridge] section markers. No commentary, no stage directions, no word counts.`,
  ].filter((l) => l !== null && l !== undefined);

  return lines.join('\n');
}

function modeLabel(mode: MusicMode): string {
  switch (mode) {
    case 'preset': return 'Recommended score';
    case 'custom_instrumental': return 'Custom instrumental';
    case 'custom_lyrics': return 'Song with lyrics';
    case 'upload': return 'Uploaded audio';
    case 'ambient_only': return 'Ambient only';
  }
}

export default function TheWords({ onNext, onBack }: StageProps) {
  const { state, update } = useBuilder();
  const previewMode = usePreviewMode();
  const [sub, setSub] = useState(0);
  const [customLine1, setCustomLine1] = useState(state.words.openingCustom[0]);
  const [customLine2, setCustomLine2] = useState(state.words.openingCustom[1]);
  const [customClosing, setCustomClosing] = useState(state.words.closingCustom);
  const [musicNote, setMusicNote] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [narrationAnswers, setNarrationAnswers] = useState<string[]>(
    state.words.narrationLetter.length === narrationQuestions.length
      ? state.words.narrationLetter
      : Array(narrationQuestions.length).fill(''),
  );
  const [isWritingLyrics, setIsWritingLyrics] = useState(false);
  const [lyricWriteError, setLyricWriteError] = useState('');

  useEffect(() => {
    function syncSubFromHash() {
      const next = WORDS_HASH_TO_SUB[window.location.hash];
      if (next !== undefined) setSub(next);
    }

    syncSubFromHash();
    window.addEventListener('hashchange', syncSubFromHash);
    return () => window.removeEventListener('hashchange', syncSubFromHash);
  }, []);

  const gender = state.gender ?? 'neutral';
  const petName = state.petName || 'them';
  const ctx = { gender, petName };

  const openingGroups = groupBy(openingArchetypes, (a) => a.group);
  const closingGroups = groupBy(closingArchetypes, (a) => a.group);
  const musicOpeningA = openingArchetypes.find((a) => a.id === state.words.opening);
  const musicClosingA = closingArchetypes.find((a) => a.id === state.words.closing);
  const musicOpeningLabel = musicOpeningA
    ? state.words.opening === 'custom'
      ? state.words.openingCustom.filter(Boolean).join('\n') || 'Custom'
      : resolveArchetype(musicOpeningA, ctx)
    : '—';
  const musicClosingLabel = musicClosingA
    ? state.words.closing === 'custom'
      ? state.words.closingCustom || 'Custom'
      : resolveArchetype(musicClosingA, ctx)
    : '—';

  const theme = state.theme ?? 'rainbow_bridge';
  const artStyle = state.style ?? 'cinematic_realism';
  const musicOptions = musicTracksFor(theme, artStyle);
  const selectedMusicTrack = musicOptions.find((m) => m.id === state.words.music);

  // Auto-select music mode when the user first enters the music sub-step.
  // Lyric intent → force custom_lyrics; standard intent → preset.
  useEffect(() => {
    if (sub !== 3) return;
    if (state.musicIntent === 'lyric') {
      if (state.words.musicMode !== 'custom_lyrics') {
        update({
          words: {
            ...state.words,
            musicMode: 'custom_lyrics',
            musicTitle: state.words.musicTitle || safeTitle(petName),
            musicStyle: state.words.musicStyle || defaultMusicStyle(state),
            musicLyrics: state.words.musicLyrics || '',
            musicApproved: false,
            musicGenerationStatus: 'idle',
            musicGenerationError: '',
            musicVariants: [],
          },
        });
      }
      return;
    }
    if (state.words.musicMode !== 'ambient_only') return;
    if (state.words.music !== 'silence') return;
    if (musicOptions.length === 0) return;
    const first = musicOptions[0];
    update({
      words: {
        ...state.words,
        musicMode: 'preset',
        music: first.id,
        musicPrompt: buildInstrumentalPrompt(state, first.name, first.mood),
        musicStyle: first.description ?? defaultMusicStyle(state),
        musicTitle: safeTitle(petName),
        musicLyrics: '',
        musicApproved: false,
        musicGenerationStatus: 'idle',
        musicGenerationError: '',
        musicVariants: [],
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub]);

  const captionKeys = Object.keys(captionTemplates).filter((k) => k !== 'custom');
  const captionSuggestions = captionKeys.flatMap((key) =>
    (captionTemplates[key] ?? []).slice(0, 1).map((t) => ({
      key,
      text: resolveText(t, ctx),
    })),
  ).slice(0, 6);

  const beatCount = state.beatCount;
  const beatIndices = Array.from({ length: beatCount }, (_, i) => i);

  function setOpening(id: string) {
    update({
      words: {
        ...state.words,
        opening: id,
        openingCustom: [customLine1, customLine2],
        musicVariants: [],
        musicApproved: false,
      },
      storyboardImages: {},
      storyboardApproved: false,
      musicBedUrl: null,
      musicBedDurationMs: null,
    });
  }

  function setClosing(id: string) {
    update({
      words: {
        ...state.words,
        closing: id,
        closingCustom: customClosing,
        musicVariants: [],
        musicApproved: false,
      },
      storyboardImages: {},
      storyboardApproved: false,
      musicBedUrl: null,
      musicBedDurationMs: null,
    });
  }

  function toggleCaption(beatIndex: number, text: string) {
    const existing = state.words.captions.find((c) => c.beatIndex === beatIndex);
    let next = state.words.captions.filter((c) => c.beatIndex !== beatIndex);
    if (!existing) {
      if (next.length < 3) next = [...next, { beatIndex, text }];
    }
    update({
      words: {
        ...state.words,
        captions: next,
        musicVariants: [],
        musicApproved: false,
      },
      storyboardImages: {},
      storyboardApproved: false,
      musicBedUrl: null,
      musicBedDurationMs: null,
    });
  }

  function setMusic(id: string) {
    if (id === state.words.music && state.words.musicMode === 'preset') return;
    const track = musicOptions.find((m) => m.id === id);
    if (id === 'silence') {
      update({
        words: {
          ...state.words,
          music: id,
          musicMode: 'ambient_only',
          musicApproved: true,
          musicGenerationStatus: 'idle',
          musicGenerationError: '',
          musicVariants: [],
        },
        musicBedUrl: null,
        musicBedDurationMs: null,
        assembledVideoUrl: null,
      });
      return;
    }
    update({
      words: {
        ...state.words,
        music: id,
        musicMode: 'preset',
        musicPrompt: buildInstrumentalPrompt(state, track?.name, track?.mood),
        musicStyle: track?.description ?? defaultMusicStyle(state),
        musicTitle: safeTitle(petName),
        musicLyrics: '',
        musicProvider: null,
        musicApproved: false,
        musicGenerationStatus: 'idle',
        musicGenerationError: '',
        musicVariants: [],
      },
      musicBedUrl: null,
      musicBedDurationMs: null,
      assembledVideoUrl: null,
    });
  }

  function setMusicMode(mode: MusicMode) {
    if (mode === 'ambient_only') {
      update({
        words: {
          ...state.words,
          music: 'silence',
          musicMode: mode,
          musicApproved: true,
          musicGenerationStatus: 'idle',
          musicGenerationError: '',
          musicVariants: [],
        },
        musicBedUrl: null,
        musicBedDurationMs: null,
        assembledVideoUrl: null,
      });
      return;
    }

    const presetId = musicOptions.some((m) => m.id === state.words.music)
      ? state.words.music
      : musicOptions.find((m) => m.id !== 'silence')?.id ?? musicOptions[0]?.id ?? 'soft_piano_01';
    const presetTrack = musicOptions.find((m) => m.id === presetId);
    const nextLyrics = mode === 'custom_lyrics'
      ? state.words.musicLyrics || buildLyricDraft(state, musicOpeningLabel, musicClosingLabel)
      : '';
    update({
      words: {
        ...state.words,
        musicMode: mode,
        music: mode === 'preset' ? presetId : mode === 'upload' ? state.words.music : mode,
        musicPrompt: mode === 'custom_instrumental'
          ? state.words.musicPrompt || buildInstrumentalPrompt(state)
          : mode === 'preset'
          ? buildInstrumentalPrompt(state, presetTrack?.name, presetTrack?.mood)
          : state.words.musicPrompt,
        musicStyle: mode === 'preset'
          ? presetTrack?.description ?? defaultMusicStyle(state)
          : state.words.musicStyle || defaultMusicStyle(state),
        musicTitle: state.words.musicTitle || safeTitle(petName),
        musicLyrics: nextLyrics,
        musicApproved: false,
        musicGenerationStatus: 'idle',
        musicGenerationError: '',
        musicVariants: [],
        narration: mode === 'custom_lyrics' ? 'off' : state.words.narration,
      },
      musicBedUrl: null,
      musicBedDurationMs: null,
      narrationUrl: mode === 'custom_lyrics' ? null : state.narrationUrl,
      narrationDurationMs: mode === 'custom_lyrics' ? null : state.narrationDurationMs,
      narrationScript: mode === 'custom_lyrics' ? null : state.narrationScript,
      narrationTimestamps: mode === 'custom_lyrics' ? null : state.narrationTimestamps,
      assembledVideoUrl: null,
    });
  }

  function updateMusicField(field: 'musicPrompt' | 'musicStyle' | 'musicTitle' | 'musicLyrics', value: string) {
    // Enforce the hard lyric cap on user edits/paste so the song can't exceed
    // the max video length.
    const capped = field === 'musicLyrics' ? capLyricWords(value, lyricMaxWords(state)) : value;
    update({
      words: {
        ...state.words,
        [field]: capped,
        musicApproved: false,
        musicGenerationStatus: state.words.musicGenerationStatus === 'ready' ? 'idle' : state.words.musicGenerationStatus,
        musicGenerationError: '',
      },
      musicBedUrl: null,
      musicBedDurationMs: null,
      assembledVideoUrl: null,
    });
  }

  async function generateLyricsWithAI() {
    if (previewMode) return;
    setIsWritingLyrics(true);
    setLyricWriteError('');
    const result = await generateText(buildLyricLLMPrompt(state));
    setIsWritingLyrics(false);
    if (!result) {
      setLyricWriteError('Could not generate lyrics — please try again or edit the draft below.');
      return;
    }
    const capped = capLyricWords(result.trim(), lyricMaxWords(state));
    update({
      words: {
        ...state.words,
        musicLyrics: capped,
        musicApproved: false,
        musicGenerationStatus: state.words.musicGenerationStatus === 'ready' ? 'idle' : state.words.musicGenerationStatus,
        musicGenerationError: '',
      },
      musicBedUrl: null,
      musicBedDurationMs: null,
      assembledVideoUrl: null,
    });
  }

  async function generateMusicTrack() {
    const mode = state.words.musicMode;
    if (mode === 'ambient_only' || mode === 'upload') return;
    const isLyrics = mode === 'custom_lyrics';
    const track = selectedMusicTrack;
    const promptBase = isLyrics
      ? buildSongBrief(state)
      : state.words.musicPrompt || buildInstrumentalPrompt(state, track?.name, track?.mood);
    const prompt = !isLyrics && musicNote.trim()
      ? `${promptBase} Adjustment: ${musicNote.trim()}`
      : promptBase;
    const title = state.words.musicTitle || safeTitle(petName);
    const style = state.words.musicStyle || (isLyrics ? defaultMusicStyle(state) : track?.description ?? defaultMusicStyle(state));
    const generationStyle = isLyrics
      ? `${style}${musicNote.trim() ? `. ${musicNote.trim()}` : ''}. ${lyricLengthInstruction(state)} End cleanly before ${songDurationLabel(state)}; no extended instrumental outro.`
      : style;
    const lyrics = state.words.musicLyrics || buildLyricDraft(state, musicOpeningLabel, musicClosingLabel);
    const durationSeconds = computeTributeAudioSeconds(state);

    update({
      words: {
        ...state.words,
        musicPrompt: prompt,
        musicStyle: style,
        musicTitle: title,
        musicLyrics: isLyrics ? lyrics : '',
        musicProvider: null,
        musicApproved: false,
        musicGenerationStatus: 'generating',
        musicGenerationError: '',
      },
      musicBedUrl: null,
      musicBedDurationMs: null,
      assembledVideoUrl: null,
    });

    if (previewMode) {
      const variant: MusicVariant = {
        url: PREVIEW_AUDIO_URL,
        durationMs: durationSeconds * 1000,
        title,
      };
      update({
        words: {
          ...state.words,
          musicPrompt: prompt,
          musicStyle: style,
          musicTitle: title,
          musicLyrics: isLyrics ? lyrics : '',
          musicProvider: 'suno',
          musicApproved: false,
          musicGenerationStatus: 'ready',
          musicGenerationError: '',
          musicVariants: [variant, ...state.words.musicVariants].slice(0, 3),
        },
        musicBedUrl: PREVIEW_AUDIO_URL,
        musicBedDurationMs: variant.durationMs,
        assembledVideoUrl: null,
      });
      return;
    }

    try {
      const res = await fetch('/api/video/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: isLyrics ? 'lyrics' : 'instrumental',
          prompt,
          lyrics: isLyrics ? lyrics : undefined,
          style: generationStyle,
          title,
          durationSeconds,
        }),
      });
      const json = (await res.json()) as {
        url?: string;
        durationMs?: number;
        title?: string;
        provider?: MusicProvider;
        error?: string;
      };
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Music generation failed');
      const variant: MusicVariant = {
        url: json.url,
        durationMs: json.durationMs ?? 0,
        title: json.title ?? title,
      };
      const shouldLock = isLyrics && state.musicIntent === 'lyric' && (json.durationMs ?? 0) > 0;
      update({
        words: {
          ...state.words,
          musicPrompt: prompt,
          musicStyle: style,
          musicTitle: title,
          musicLyrics: isLyrics ? lyrics : '',
          musicProvider: json.provider ?? 'suno',
          musicApproved: false,
          musicGenerationStatus: 'ready',
          musicGenerationError: '',
          musicVariants: [variant, ...state.words.musicVariants].slice(0, 3),
        },
        musicBedUrl: json.url,
        musicBedDurationMs: json.durationMs ?? null,
        // Lock the video to the song length, but never beyond the max video
        // length (beatCount*15 + cards) — so an over-long song trims/fades
        // instead of stretching the video into a freeze-frame.
        lockedDurationSeconds: shouldLock
          ? Math.min(Math.ceil((json.durationMs as number) / 1000), maxVideoSeconds(state))
          : state.lockedDurationSeconds,
        assembledVideoUrl: null,
      });
    } catch (err) {
      update({
        words: {
          ...state.words,
          musicPrompt: prompt,
          musicStyle: style,
          musicTitle: title,
          musicLyrics: isLyrics ? lyrics : '',
          musicApproved: false,
          musicGenerationStatus: 'failed',
          musicGenerationError: err instanceof Error ? err.message : 'Music generation failed',
        },
        musicBedUrl: null,
        musicBedDurationMs: null,
        assembledVideoUrl: null,
      });
    }
  }

  function approveMusic() {
    update({
      words: {
        ...state.words,
        musicApproved: true,
        musicGenerationStatus: state.musicBedUrl ? 'ready' : state.words.musicGenerationStatus,
        narration: state.words.musicMode === 'custom_lyrics' ? 'off' : state.words.narration,
      },
      narrationUrl: state.words.musicMode === 'custom_lyrics' ? null : state.narrationUrl,
      narrationDurationMs: state.words.musicMode === 'custom_lyrics' ? null : state.narrationDurationMs,
      narrationScript: state.words.musicMode === 'custom_lyrics' ? null : state.narrationScript,
      narrationTimestamps: state.words.musicMode === 'custom_lyrics' ? null : state.narrationTimestamps,
      assembledVideoUrl: null,
    });
  }

  async function handleMusicUpload(file: File | undefined) {
    if (!file) return;
    update({
      words: {
        ...state.words,
        musicMode: 'upload',
        musicTitle: file.name,
        musicProvider: null,
        musicApproved: false,
        musicGenerationStatus: 'generating',
        musicGenerationError: '',
      },
      musicBedUrl: null,
      musicBedDurationMs: null,
      assembledVideoUrl: null,
    });

    if (previewMode) {
      const previewUrl = typeof URL !== 'undefined' ? URL.createObjectURL(file) : PREVIEW_AUDIO_URL;
      update({
        words: {
          ...state.words,
          musicMode: 'upload',
          musicTitle: file.name,
          musicProvider: 'upload',
          musicApproved: true,
          musicGenerationStatus: 'ready',
          musicGenerationError: '',
          musicVariants: [{ url: previewUrl, durationMs: 0, title: file.name }],
        },
        musicBedUrl: previewUrl,
        musicBedDurationMs: null,
        assembledVideoUrl: null,
      });
      return;
    }

    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/audio/upload', { method: 'POST', body: form });
      const json = (await res.json()) as { url?: string; durationMs?: number; title?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Audio upload failed');
      // When the user brings their own audio, the audio is the master clock:
      // lock the tribute length to the upload's actual duration (same mechanism
      // as lyric mode). Compose + perBeatSeconds key off lockedDurationSeconds.
      const uploadSec = json.durationMs && json.durationMs > 0
        ? Math.ceil(json.durationMs / 1000)
        : state.lockedDurationSeconds;
      update({
        words: {
          ...state.words,
          musicMode: 'upload',
          musicTitle: json.title ?? file.name,
          musicProvider: 'upload',
          musicApproved: true,
          musicGenerationStatus: 'ready',
          musicGenerationError: '',
          musicVariants: [{ url: json.url, durationMs: json.durationMs ?? 0, title: json.title ?? file.name }],
        },
        musicBedUrl: json.url,
        musicBedDurationMs: json.durationMs ?? null,
        lockedDurationSeconds: uploadSec,
        assembledVideoUrl: null,
      });
    } catch (err) {
      update({
        words: {
          ...state.words,
          musicMode: 'upload',
          musicTitle: file.name,
          musicProvider: null,
          musicApproved: false,
          musicGenerationStatus: 'failed',
          musicGenerationError: err instanceof Error ? err.message : 'Audio upload failed',
        },
        musicBedUrl: null,
        musicBedDurationMs: null,
        assembledVideoUrl: null,
      });
    }
  }

  function setNarration(id: string) {
    if (state.words.musicMode === 'custom_lyrics' && id !== 'off') return;
    if (id === state.words.narration) return;
    update({
      words: { ...state.words, narration: id },
      narrationUrl: null,
      narrationDurationMs: null,
      narrationScript: null,
      narrationTimestamps: null,
      assembledVideoUrl: null,
    });
  }

  function setSubtitles(on: boolean) {
    if (on === state.words.subtitles) return;
    update({ words: { ...state.words, subtitles: on }, assembledVideoUrl: null });
  }

  function advance() {
    if (sub < SUB_STEPS.length - 1) setSub(sub + 1);
  }
  function retreat() {
    if (sub > 0) setSub(sub - 1);
    else onBack();
  }

  // 5.5.1 — Opening
  if (sub === 0) {
    return (
      <StageShell
        eyebrow="The Words"
        title={<>How should it <em>open</em>?</>}
        lede="The first words your tribute shows. Pick one or write your own — every option works."
        onNext={advance}
        onBack={retreat}
        canNext={true}
        nextLabel="Next: Closing"
      >
        {Object.entries(openingGroups).map(([group, archetypes]) => (
          <div key={group} style={{ marginBottom: 28 }}>
            <div style={{ marginBottom: 12 }}><Eyebrow>{group}</Eyebrow></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {archetypes.map((a) => {
                const isCustom = a.id === 'custom';
                const active = state.words.opening === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setOpening(a.id)}
                    style={{
                      padding: '10px 18px',
                      border: active ? SELECTED_BORDER : `1px solid ${PALETTE.parchmentLight}`,
                      background: active ? PALETTE.boneSoft : 'white',
                      boxShadow: active ? SELECTED_RING : 'none',
                      borderRadius: 999,
                      cursor: 'pointer',
                      fontFamily: '"Cormorant Garamond", serif',
                      fontSize: 16,
                      fontStyle: 'italic',
                      color: PALETTE.espresso,
                      transition: 'all 180ms ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {isCustom ? 'Write my own…' : resolveArchetype(a, ctx)}
                    {active && <Check size={13} color={PALETTE.espresso} />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {state.words.opening === 'custom' && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              value={customLine1}
              onChange={(e) => {
                setCustomLine1(e.target.value);
                update({ words: { ...state.words, openingCustom: [e.target.value, customLine2] } });
              }}
              placeholder="Line one…"
              style={{
                width: '100%',
                border: `1px solid ${PALETTE.parchment}`,
                borderRadius: 2,
                outline: 'none',
                padding: '12px 16px',
                fontFamily: '"Cormorant Garamond", serif',
                fontSize: 20,
                fontStyle: 'italic',
                color: PALETTE.espresso,
                background: 'white',
                boxSizing: 'border-box',
              }}
            />
            <input
              value={customLine2}
              onChange={(e) => {
                setCustomLine2(e.target.value);
                update({ words: { ...state.words, openingCustom: [customLine1, e.target.value] } });
              }}
              placeholder="Line two (optional)…"
              style={{
                width: '100%',
                border: `1px solid ${PALETTE.parchment}`,
                borderRadius: 2,
                outline: 'none',
                padding: '12px 16px',
                fontFamily: '"Cormorant Garamond", serif',
                fontSize: 20,
                fontStyle: 'italic',
                color: PALETTE.espresso,
                background: 'white',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}
      </StageShell>
    );
  }

  // 5.5.2 — Closing
  if (sub === 1) {
    return (
      <StageShell
        eyebrow="The Words"
        title={<>And how should it <em>close</em>?</>}
        lede="The final line. It will appear over the last scene."
        onNext={advance}
        onBack={retreat}
        canNext={true}
        nextLabel="Next: Captions"
      >
        {Object.entries(closingGroups).map(([group, archetypes]) => (
          <div key={group} style={{ marginBottom: 28 }}>
            <div style={{ marginBottom: 12 }}><Eyebrow>{group}</Eyebrow></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {archetypes.map((a) => {
                const active = state.words.closing === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setClosing(a.id)}
                    style={{
                      padding: '10px 18px',
                      border: active ? SELECTED_BORDER : `1px solid ${PALETTE.parchmentLight}`,
                      background: active ? PALETTE.boneSoft : 'white',
                      boxShadow: active ? SELECTED_RING : 'none',
                      borderRadius: 999,
                      cursor: 'pointer',
                      fontFamily: '"Cormorant Garamond", serif',
                      fontSize: 16,
                      fontStyle: 'italic',
                      color: PALETTE.espresso,
                      transition: 'all 180ms ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {a.id === 'custom' ? 'Write my own…' : resolveArchetype(a, ctx)}
                    {active && <Check size={13} color={PALETTE.espresso} />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {state.words.closing === 'custom' && (
          <div style={{ marginTop: 16 }}>
            <input
              value={customClosing}
              onChange={(e) => {
                setCustomClosing(e.target.value);
                update({ words: { ...state.words, closingCustom: e.target.value } });
              }}
              placeholder="Your closing line…"
              style={{
                width: '100%',
                border: `1px solid ${PALETTE.parchment}`,
                borderRadius: 2,
                outline: 'none',
                padding: '12px 16px',
                fontFamily: '"Cormorant Garamond", serif',
                fontSize: 20,
                fontStyle: 'italic',
                color: PALETTE.espresso,
                background: 'white',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}
      </StageShell>
    );
  }

  // 5.5.3 — Mid-tribute captions
  if (sub === 2) {
    const voiceHint = state.format ? captionVoiceFor(state.format) : null;
    return (
      <StageShell
        eyebrow="The Words"
        title={<>A few <em>caption moments</em>?</>}
        lede={`Pick up to 3 beats to add a caption to. Suggestions below are resolved to ${petName}'s voice.`}
        onNext={advance}
        onBack={retreat}
        canNext={true}
        nextLabel="Next: Music"
      >
        {voiceHint && (
          <div style={{ background: PALETTE.boneSoft, border: `1px solid ${PALETTE.parchmentLight}`, borderRadius: 4, padding: '10px 14px', marginBottom: 20, display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <Sans style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: PALETTE.mute, flexShrink: 0 }}>Voice</Sans>
            <Sans style={{ fontSize: 13, color: PALETTE.espresso, fontStyle: 'italic' }}>{voiceHint.tenseHint}</Sans>
          </div>
        )}
        <Sans
          style={{
            fontSize: 13,
            color: PALETTE.mute,
            marginBottom: 20,
            fontStyle: 'italic',
          }}
        >
          {state.words.captions.length === 0
            ? 'No captions selected — skipping is perfectly fine.'
            : `${state.words.captions.length} of 3 selected.`}
        </Sans>
        <FieldGroup label="Choose beats to caption">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {beatIndices.map((i) => {
              const selected = state.words.captions.find((c) => c.beatIndex === i);
              const locked = !selected && state.words.captions.length >= 3;
              return (
                <button
                  key={i}
                  onClick={() => {
                    if (locked) return;
                    const suggestion = captionSuggestions[i % captionSuggestions.length]?.text ?? '';
                    toggleCaption(i, selected ? selected.text : suggestion);
                  }}
                  style={{
                    padding: '8px 14px',
                    border: selected ? SELECTED_BORDER : `1px solid ${PALETTE.parchmentLight}`,
                    background: selected ? PALETTE.boneSoft : 'white',
                    boxShadow: selected ? SELECTED_RING : 'none',
                    borderRadius: 999,
                    cursor: locked ? 'not-allowed' : 'pointer',
                    opacity: locked ? 0.45 : 1,
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 13,
                    color: PALETTE.espresso,
                    transition: 'all 180ms ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  Beat {i + 1}
                  {selected && <Check size={11} color={PALETTE.espresso} />}
                </button>
              );
            })}
          </div>
        </FieldGroup>

        {state.words.captions.length > 0 && (
          <FieldGroup label="Edit captions">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {state.words.captions.map((cap) => (
                <div key={cap.beatIndex} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Sans
                    style={{
                      fontSize: 12,
                      color: PALETTE.mute,
                      minWidth: 52,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Beat {cap.beatIndex + 1}
                  </Sans>
                  <input
                    value={cap.text}
                    onChange={(e) => {
                      const next = state.words.captions.map((c) =>
                        c.beatIndex === cap.beatIndex ? { ...c, text: e.target.value } : c,
                      );
                      update({
                        words: { ...state.words, captions: next, musicVariants: [], musicApproved: false },
                        storyboardImages: {},
                        storyboardApproved: false,
                        musicBedUrl: null,
                        musicBedDurationMs: null,
                      });
                    }}
                    style={{
                      flex: 1,
                      border: `1px solid ${PALETTE.parchment}`,
                      borderRadius: 2,
                      outline: 'none',
                      padding: '10px 14px',
                      fontFamily: '"Cormorant Garamond", serif',
                      fontSize: 18,
                      fontStyle: 'italic',
                      color: PALETTE.espresso,
                      background: 'white',
                    }}
                  />
                </div>
              ))}
            </div>
          </FieldGroup>
        )}

        <FieldGroup label="Caption suggestions" hint="click to use">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {captionSuggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => {
                  const firstUnused = beatIndices.find(
                    (i) => !state.words.captions.find((c) => c.beatIndex === i),
                  );
                  if (firstUnused === undefined || state.words.captions.length >= 3) return;
                  const next = [...state.words.captions, { beatIndex: firstUnused, text: s.text }];
                  update({
                    words: { ...state.words, captions: next, musicVariants: [], musicApproved: false },
                    storyboardImages: {},
                    storyboardApproved: false,
                    musicBedUrl: null,
                    musicBedDurationMs: null,
                  });
                }}
                style={{
                  padding: '8px 14px',
                  border: `1px solid ${PALETTE.parchmentLight}`,
                  background: 'white',
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontFamily: '"Cormorant Garamond", serif',
                  fontSize: 15,
                  fontStyle: 'italic',
                  color: PALETTE.mute,
                  transition: 'all 180ms ease',
                }}
              >
                {s.text}
              </button>
            ))}
          </div>
        </FieldGroup>
      </StageShell>
    );
  }

  // 5.5.4 — Music
  if (sub === 3) {
    const mode = state.words.musicMode;
    const isGenerating = state.words.musicGenerationStatus === 'generating';
    const canContinue = mode === 'ambient_only' || (state.words.musicApproved && !!state.musicBedUrl);
    const intentIsLyric = state.musicIntent === 'lyric';

    // Allowed mode tabs vary by musicIntent.
    const allowedModes: Array<[MusicMode, string]> = intentIsLyric
      ? [['custom_lyrics', 'Create song with lyrics']]
      : [
          ['preset', 'Recommended score'],
          ['custom_instrumental', 'Create instrumental'],
          ['upload', 'Upload audio'],
          ['ambient_only', 'Ambient only'],
        ];

    return (
      <StageShell
        eyebrow="The Words"
        title={<>What should <em>{petName}</em> sound like?</>}
        lede="Choose a gentle score, create original music, or let the scene ambience carry the tribute."
        onNext={advance}
        onBack={retreat}
        canNext={canContinue}
        nextLabel="Next: Narration"
      >
        {intentIsLyric ? (
          <div style={{ marginBottom: 20, padding: '10px 14px', background: 'rgba(201,169,97,0.06)', border: `1px solid ${PALETTE.brass}`, borderRadius: 4, display: 'inline-block' }}>
            <Sans style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: PALETTE.brassDeep }}>Lyric song</Sans>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
            {allowedModes.map(([id, label]) => (
              <button
                key={id}
                onClick={() => setMusicMode(id)}
                style={{
                  padding: '9px 15px',
                  border: mode === id ? SELECTED_BORDER : `1px solid ${PALETTE.parchmentLight}`,
                  background: mode === id ? PALETTE.espresso : 'white',
                  color: mode === id ? PALETTE.bone : PALETTE.espresso,
                  boxShadow: mode === id ? SELECTED_RING : 'none',
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 13,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {mode === 'preset' && (
          <FieldGroup label="Recommended scores" hint="choose one, then generate a preview">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {musicOptions.map((m, idx) => {
                const active = state.words.music === m.id;
                const isRecommended = idx === 0;
                const wavePattern = m.mood.includes('ambient') || m.mood === 'ethereal'
                  ? 'pads'
                  : m.mood.includes('string')
                  ? 'strings'
                  : m.id === 'silence'
                  ? 'silence'
                  : 'piano';
                return (
                  <button
                    key={m.id}
                    onClick={() => setMusic(m.id)}
                    style={{
                      textAlign: 'left',
                      padding: '14px 16px',
                      border: active ? SELECTED_BORDER : `1px solid ${PALETTE.parchmentLight}`,
                      background: active ? PALETTE.boneSoft : 'white',
                      boxShadow: active ? SELECTED_RING : 'none',
                      cursor: 'pointer',
                      borderRadius: 4,
                      transition: 'all 180ms ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    {isRecommended && (
                      <span style={{
                        alignSelf: 'flex-start',
                        fontSize: 10,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        fontFamily: 'Inter, sans-serif',
                        color: PALETTE.brassDeep,
                        background: PALETTE.boneSoft,
                        border: `1px solid ${PALETTE.parchmentLight}`,
                        borderRadius: 2,
                        padding: '2px 6px',
                      }}>Recommended</span>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: PALETTE.espresso,
                          color: PALETTE.bone,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Play size={11} style={{ marginLeft: 1 }} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Serif style={{ fontSize: 16, lineHeight: 1.1 }}>{m.name}</Serif>
                        <Sans style={{ fontSize: 11, color: PALETTE.mute, marginTop: 2 }}>
                          {m.description}
                        </Sans>
                      </div>
                      {active && <Check size={13} color={PALETTE.espresso} />}
                    </div>
                    <Waveform pattern={wavePattern} playing={active} />
                  </button>
                );
              })}
            </div>
          </FieldGroup>
        )}

        {mode === 'custom_instrumental' && (
          <>
            <FieldGroup label="Describe the score" hint="no vocals">
              <textarea
                value={state.words.musicPrompt || buildInstrumentalPrompt(state)}
                onChange={(e) => updateMusicField('musicPrompt', e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 14,
                  padding: '12px 14px',
                  border: `1px solid ${PALETTE.parchmentLight}`,
                  borderRadius: 4,
                  background: PALETTE.boneSoft,
                  color: PALETTE.espresso,
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </FieldGroup>
            <FieldGroup label="Style direction">
              <input
                value={state.words.musicStyle || 'soft piano, warm strings, gentle cinematic memorial score'}
                onChange={(e) => updateMusicField('musicStyle', e.target.value)}
                style={{
                  width: '100%',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 14,
                  padding: '11px 14px',
                  border: `1px solid ${PALETTE.parchmentLight}`,
                  borderRadius: 4,
                  background: PALETTE.boneSoft,
                  color: PALETTE.espresso,
                  boxSizing: 'border-box',
                }}
              />
            </FieldGroup>
          </>
        )}

        {mode === 'custom_lyrics' && (
          <>
            <div style={{ marginBottom: 18, padding: '12px 14px', background: PALETTE.boneSoft, border: `1px solid ${PALETTE.parchmentLight}`, borderRadius: 4 }}>
              <Sans style={{ fontSize: 13, color: PALETTE.espresso, lineHeight: 1.5 }}>
                A lyric song becomes the foreground audio. Voiceover will stay off so {petName}&apos;s song has room to breathe.
                {' '}The draft below uses all {state.beatSheet.length || state.beatCount} beat-card lines and is paced for a {songDurationLabel(state)} tribute.
              </Sans>
            </div>
            <FieldGroup label="Song title">
              <input
                value={state.words.musicTitle || safeTitle(petName)}
                onChange={(e) => updateMusicField('musicTitle', e.target.value)}
                style={{
                  width: '100%',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 14,
                  padding: '11px 14px',
                  border: `1px solid ${PALETTE.parchmentLight}`,
                  borderRadius: 4,
                  background: PALETTE.boneSoft,
                  color: PALETTE.espresso,
                  boxSizing: 'border-box',
                }}
              />
            </FieldGroup>
            <FieldGroup label="Music style">
              <input
                value={state.words.musicStyle || defaultMusicStyle(state)}
                onChange={(e) => updateMusicField('musicStyle', e.target.value)}
                style={{
                  width: '100%',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 14,
                  padding: '11px 14px',
                  border: `1px solid ${PALETTE.parchmentLight}`,
                  borderRadius: 4,
                  background: PALETTE.boneSoft,
                  color: PALETTE.espresso,
                  boxSizing: 'border-box',
                }}
              />
            </FieldGroup>
            <FieldGroup
              label="Lyrics"
              hint={
                <button
                  onClick={() => updateMusicField('musicLyrics', buildLyricDraft(state, musicOpeningLabel, musicClosingLabel))}
                  style={{ border: 'none', background: 'transparent', color: PALETTE.brassDeep, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 12 }}
                >
                  Rebuild from beat cards and {petName}&apos;s details
                </button>
              }
            >
              <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={() => void generateLyricsWithAI()}
                  disabled={isWritingLyrics}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '9px 16px',
                    border: `1px solid ${PALETTE.brass}`,
                    background: isWritingLyrics ? PALETTE.parchmentLight : PALETTE.boneSoft,
                    color: isWritingLyrics ? PALETTE.mute : PALETTE.brassDeep,
                    borderRadius: 3,
                    cursor: isWritingLyrics ? 'not-allowed' : 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 13,
                    transition: 'all 180ms ease',
                  }}
                >
                  {isWritingLyrics
                    ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Sparkles size={14} />}
                  {isWritingLyrics ? 'Writing…' : 'Write lyrics for me'}
                </button>
                <Sans style={{ fontSize: 12, color: PALETTE.mute, fontStyle: 'italic' }}>
                  Lyrics are sized to your video length (~{lyricMaxWords(state)} words) so the song matches the scenes.
                </Sans>
              </div>
              {lyricWriteError && (
                <Sans style={{ fontSize: 12, color: '#B91C1C', marginBottom: 8, lineHeight: 1.5 }}>
                  {lyricWriteError}
                </Sans>
              )}
              <textarea
                value={state.words.musicLyrics || buildLyricDraft(state, musicOpeningLabel, musicClosingLabel)}
                onChange={(e) => updateMusicField('musicLyrics', e.target.value)}
                rows={14}
                style={{
                  width: '100%',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 13,
                  lineHeight: 1.45,
                  padding: '12px 14px',
                  border: `1px solid ${PALETTE.parchmentLight}`,
                  borderRadius: 4,
                  background: PALETTE.boneSoft,
                  color: PALETTE.espresso,
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </FieldGroup>
          </>
        )}

        {mode === 'upload' && (
          <FieldGroup label="Upload audio" hint="audio files only">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={(e) => handleMusicUpload(e.target.files?.[0])}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 18px',
                border: `1px solid ${PALETTE.espresso}`,
                background: 'white',
                color: PALETTE.espresso,
                borderRadius: 3,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
              }}
            >
              <Upload size={14} /> Choose audio file
            </button>
            {state.words.musicGenerationStatus === 'generating' && (
              <Sans style={{ marginTop: 12, fontSize: 13, color: PALETTE.mute }}>
                Uploading audio...
              </Sans>
            )}
            {state.words.musicGenerationError && (
              <Sans style={{ marginTop: 12, fontSize: 13, color: '#B91C1C', lineHeight: 1.5 }}>
                {state.words.musicGenerationError}
              </Sans>
            )}
            {state.musicBedUrl && (
              <div style={{ marginTop: 16 }}>
                <audio src={state.musicBedUrl} controls style={{ width: '100%' }} />
              </div>
            )}
          </FieldGroup>
        )}

        {mode !== 'ambient_only' && mode !== 'upload' && (
          <div style={{ borderTop: `1px solid ${PALETTE.parchmentLight}`, paddingTop: 24 }}>
            <FieldGroup label="Specific adjustment" hint="optional">
              <input
                value={musicNote}
                onChange={(e) => setMusicNote(e.target.value)}
                placeholder="e.g. softer piano, less dramatic, more hopeful"
                style={{
                  width: '100%',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 14,
                  padding: '11px 14px',
                  border: `1px solid ${PALETTE.parchmentLight}`,
                  borderRadius: 4,
                  background: 'white',
                  color: PALETTE.espresso,
                  boxSizing: 'border-box',
                }}
              />
            </FieldGroup>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => void generateMusicTrack()}
                disabled={isGenerating}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 18px',
                  border: 'none',
                  background: isGenerating ? PALETTE.parchmentLight : PALETTE.espresso,
                  color: isGenerating ? PALETTE.mute : PALETTE.bone,
                  borderRadius: 3,
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 13,
                }}
              >
                {isGenerating ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
                {state.musicBedUrl ? 'Generate another version' : 'Generate music'}
              </button>
              {state.musicBedUrl && !state.words.musicApproved && (
                <button
                  onClick={approveMusic}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '12px 18px',
                    border: `1px solid ${PALETTE.espresso}`,
                    background: PALETTE.boneSoft,
                    color: PALETTE.espresso,
                    borderRadius: 3,
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 13,
                  }}
                >
                  <Check size={14} /> Use this music
                </button>
              )}
              {state.words.musicApproved && state.musicBedUrl && (
                <Sans style={{ fontSize: 13, color: PALETTE.brassDeep }}>Music approved.</Sans>
              )}
            </div>
            {state.words.musicGenerationError && (
              <Sans style={{ marginTop: 12, fontSize: 13, color: '#B91C1C', lineHeight: 1.5 }}>
                {state.words.musicGenerationError}
              </Sans>
            )}
            {state.musicBedUrl && (
              <div style={{ marginTop: 18 }}>
                <audio src={state.musicBedUrl} controls style={{ width: '100%' }} />
                {(() => {
                  if (state.musicIntent === 'lyric') return null;
                  if (!state.musicBedDurationMs || state.musicBedDurationMs <= 0) return null;
                  const tributeSec = computeTributeAudioSeconds(state);
                  const songSec = state.musicBedDurationMs / 1000;
                  if (songSec <= tributeSec + 30) return null;
                  return (
                    <Serif italic style={{ display: 'block', marginTop: 10, fontSize: 13, color: PALETTE.mute, lineHeight: 1.5 }}>
                      Your song is {fmtMmSs(songSec)}. We&apos;ll fade it out at {fmtMmSs(tributeSec)} to match your tribute length.
                    </Serif>
                  );
                })()}
              </div>
            )}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {mode === 'ambient_only' && (
          <div style={{ padding: '18px 20px', background: PALETTE.boneSoft, border: `1px solid ${PALETTE.parchmentLight}`, borderRadius: 4 }}>
            <Serif italic style={{ fontSize: 18, color: PALETTE.espressoSoft }}>
              No music selected. The scene ambience will carry the tribute.
            </Serif>
          </div>
        )}
      </StageShell>
    );
  }


  // 5.5.5 — Narration
  if (sub === 4) {
    const narrationOn = state.words.narration !== 'off';
    return (
      <StageShell
        eyebrow="The Words"
        title={<>Would you like a <em>voiceover</em>?</>}
        lede="Optional. Music alone is the gentle default — narration adds your words to the tribute."
        onNext={advance}
        onBack={retreat}
        canNext={true}
        nextLabel="Next: Review"
      >
        {state.words.musicMode === 'custom_lyrics' && (
          <div style={{ marginBottom: 20, padding: '12px 14px', background: PALETTE.boneSoft, border: `1px solid ${PALETTE.parchmentLight}`, borderRadius: 4 }}>
            <Sans style={{ fontSize: 13, color: PALETTE.espresso, lineHeight: 1.5 }}>
              Voiceover is off because you chose a song with lyrics. The song will carry the spoken layer of the tribute.
            </Sans>
          </div>
        )}
        <FieldGroup label="Narration">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 10,
            }}
          >
            <button
              onClick={() => setNarration('off')}
              style={{
                textAlign: 'left',
                padding: '12px 14px',
                border: !narrationOn ? SELECTED_BORDER : `1px solid ${PALETTE.parchmentLight}`,
                background: !narrationOn ? PALETTE.boneSoft : 'white',
                boxShadow: !narrationOn ? SELECTED_RING : 'none',
                cursor: 'pointer',
                borderRadius: 4,
                transition: 'all 180ms ease',
              }}
            >
              <Serif style={{ fontSize: 16 }}>No narration</Serif>
              <Sans style={{ fontSize: 12, color: PALETTE.mute, marginTop: 4 }}>
                Music carries the tribute
              </Sans>
            </button>
            {narrationVoices
              .filter((v) => v.id !== 'user_recorded' && state.words.musicMode !== 'custom_lyrics')
              .map((v) => {
                const active = state.words.narration === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setNarration(v.id)}
                    style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      border: active ? SELECTED_BORDER : `1px solid ${PALETTE.parchmentLight}`,
                      background: active ? PALETTE.boneSoft : 'white',
                      boxShadow: active ? SELECTED_RING : 'none',
                      cursor: 'pointer',
                      borderRadius: 4,
                      transition: 'all 180ms ease',
                    }}
                  >
                    <Serif style={{ fontSize: 16 }}>{v.name}</Serif>
                    <Sans style={{ fontSize: 12, color: PALETTE.mute, marginTop: 4 }}>
                      {v.description}
                    </Sans>
                  </button>
                );
              })}
          </div>
        </FieldGroup>

        {narrationOn && (
          <FieldGroup label="Subtitles" hint="On-screen captions of the narration, synced to the voice.">
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ id: true, label: 'On' }, { id: false, label: 'Off' }].map(({ id, label }) => {
                const active = state.words.subtitles === id;
                return (
                  <button
                    key={label}
                    onClick={() => setSubtitles(id)}
                    style={{
                      padding: '10px 18px',
                      border: active ? SELECTED_BORDER : `1px solid ${PALETTE.parchmentLight}`,
                      background: active ? PALETTE.boneSoft : 'white',
                      boxShadow: active ? SELECTED_RING : 'none',
                      borderRadius: 999,
                      cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 13,
                      color: PALETTE.espresso,
                      transition: 'all 180ms ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {label}
                    {active && <Check size={11} color={PALETTE.espresso} />}
                  </button>
                );
              })}
            </div>
          </FieldGroup>
        )}

        {narrationOn && (
          <FieldGroup label="A few questions for the voiceover" hint="optional — all skippable">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {NARRATION_QUESTIONS.map((q, idx) => (
                <div key={idx}>
                  <Sans
                    style={{ fontSize: 13, color: PALETTE.mute, marginBottom: 6, fontStyle: 'italic' }}
                  >
                    {q}
                  </Sans>
                  <textarea
                    value={narrationAnswers[idx] ?? ''}
                    onChange={(e) => {
                      const next = [...narrationAnswers];
                      next[idx] = e.target.value;
                      setNarrationAnswers(next);
                      update({ words: { ...state.words, narrationLetter: next } });
                    }}
                    rows={2}
                    placeholder="Optional…"
                    style={{
                      width: '100%',
                      fontFamily: '"Cormorant Garamond", serif',
                      fontSize: 17,
                      fontStyle: 'italic',
                      padding: '10px 14px',
                      border: `1px solid ${PALETTE.parchmentLight}`,
                      borderRadius: 2,
                      background: PALETTE.boneSoft,
                      color: PALETTE.espresso,
                      resize: 'vertical',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>
              ))}
            </div>
          </FieldGroup>
        )}
      </StageShell>
    );
  }

  // 5.5.6 — Review summary (GateReview-like, but technically part of TheWords — "Yes" sets reviewed)
  const openingA = openingArchetypes.find((a) => a.id === state.words.opening);
  const closingA = closingArchetypes.find((a) => a.id === state.words.closing);
  const openingLabel = openingA
    ? state.words.opening === 'custom'
      ? state.words.openingCustom[0] || 'Custom'
      : resolveArchetype(openingA, ctx)
    : '—';
  const closingLabel = closingA
    ? state.words.closing === 'custom'
      ? state.words.closingCustom || 'Custom'
      : resolveArchetype(closingA, ctx)
    : '—';
  const musicTrack = musicOptions.find((m) => m.id === state.words.music);

  return (
    <GateReview
      eyebrow="The Words"
      title={<>These are <em>{petName}&apos;s</em> words.</>}
      lede="A summary of everything you&apos;ve chosen. When it feels right, continue."
      options={[
        { id: 'yes', label: 'Yes — these feel right', tone: 'primary' },
        { id: 'opening', label: 'Change the opening' },
        { id: 'closing', label: 'Change the closing' },
        { id: 'music', label: 'Change the music' },
      ]}
      onSelect={(id) => {
        if (id === 'yes') {
          update({ words: { ...state.words, reviewed: true } });
          onNext();
        } else if (id === 'opening') setSub(0);
        else if (id === 'closing') setSub(1);
        else if (id === 'music') setSub(3);
      }}
      onBack={retreat}
    >
      <div
        style={{
          background: PALETTE.boneSoft,
          border: `1px solid ${PALETTE.parchmentLight}`,
          borderRadius: 4,
          padding: '20px 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 20,
        }}
      >
        <SummaryItem label="Opening" value={openingLabel} />
        <SummaryItem label="Closing" value={closingLabel} />
        <SummaryItem
          label="Captions"
          value={
            state.words.captions.length === 0
              ? 'None'
              : `${state.words.captions.length} beat${state.words.captions.length > 1 ? 's' : ''}`
          }
        />
        <SummaryItem
          label="Music"
          value={
            state.words.musicMode === 'ambient_only'
              ? 'Ambient only'
              : state.words.musicTitle || musicTrack?.name || modeLabel(state.words.musicMode)
          }
        />
        <SummaryItem
          label="Narration"
          value={
            state.words.narration === 'off'
              ? 'None'
              : narrationVoices.find((v) => v.id === state.words.narration)?.name ?? 'On'
          }
        />
        {state.words.narration !== 'off' && (
          <SummaryItem label="Subtitles" value={state.words.subtitles ? 'On' : 'Off'} />
        )}
      </div>
    </GateReview>
  );
}
