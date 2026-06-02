"use client";

import React, { createContext, useContext, useState } from 'react';
import type {
  FormatId,
  ThemeCategoryId,
  ThemeId,
  ArtStyleId,
  ContainerId,
  CuratorPickId,
  RelationshipId,
  Gender,
  AspectId,
  DpStyleId,
  BeatArchetype,
  CameraMove,
  LightingMotion,
  DofBehavior,
  AmbientAudio,
} from '@/lib/peternal-library';
import type { NarrationWord } from '@/lib/peternal-subtitles';
import type { StepId } from './steps';

export type { Gender, RelationshipId, AspectId, FormatId, ThemeId, ThemeCategoryId, ArtStyleId, ContainerId, CuratorPickId, DpStyleId, BeatArchetype };

export interface PetPhoto {
  id: string;
  name: string;
  file?: File;
  preview?: string;
  url?: string;
}

export interface PetProfile {
  species: string;
  speciesConfidence: 'high' | 'medium' | 'low';
  breedGuess: string;
  breedConfidence: 'high' | 'medium' | 'low';
  coatDescription: string;
  coatConfidence: 'high' | 'medium' | 'low';
  ageRange: 'puppy_kitten' | 'young_adult' | 'adult' | 'senior';
  ageConfidence: 'high' | 'medium' | 'low';
  bodyType?: 'tiny' | 'small' | 'medium' | 'large' | 'giant';
  observedSetting?: string;
  observedMoment?: string;
  visionFailed: boolean;
}

export interface Beat {
  index: number;
  archetype: BeatArchetype;
  name: string;
  visual: string;
  caption: string;
  spokenOrTitle: string;
  sceneHintSource?: string;
  lengthSeconds: 15;
}

export interface CinematographyBrief {
  beatIndex: number;
  lensMm: 24 | 35 | 50 | 85 | 105;
  lensCharacter: 'wide_establishing' | 'standard' | 'portrait' | 'compression';
  cameraMove: CameraMove;
  moveIntensity: 'barely_perceptible' | 'gentle' | 'pronounced';
  subjectMotion: 'locked' | 'breath_only' | 'loop_idle' | 'loop_action' | 'one_shot_action';
  lightingMotion: LightingMotion;
  dofBehavior: DofBehavior;
  shotStructure: 'single_sustained' | 'two_shot_cut' | 'three_shot_montage';
  ambientAudio: AmbientAudio;
  audioIntensity: 'bed_only' | 'present' | 'forward';
}

export type MusicMode = 'preset' | 'custom_instrumental' | 'custom_lyrics' | 'upload' | 'ambient_only';
export type MusicGenerationStatus = 'idle' | 'generating' | 'ready' | 'failed';
export type MusicProvider = 'suno' | 'fal' | 'upload' | null;

export interface MusicVariant {
  url: string;
  durationMs: number;
  title?: string;
}

export interface WordsState {
  opening: string;
  openingCustom: [string, string];
  closing: string;
  closingCustom: string;
  captions: { beatIndex: number; text: string }[];
  music: string;
  musicMode: MusicMode;
  musicPrompt: string;
  musicStyle: string;
  musicTitle: string;
  musicLyrics: string;
  musicProvider: MusicProvider;
  musicApproved: boolean;
  musicGenerationStatus: MusicGenerationStatus;
  musicGenerationError: string;
  musicVariants: MusicVariant[];
  narration: 'off' | string;
  narrationLetter: string[];
  subtitles: boolean;
  reviewed: boolean;
}

export interface BuilderState {
  returningUser: boolean | null;
  petPhotos: PetPhoto[];
  petName: string;
  petNamePronunciation: string;
  gender: Gender | null;
  petProfile: PetProfile | null;
  memoryPromptType: string | null;
  memoryPromptAnswer: string;
  relationship: RelationshipId | null;
  traits: string[];
  favorites: string[];
  creatorName: string;
  years: string;
  yearsIncluded: boolean;
  characterSheetApproved: boolean;
  characterSheetRefinements: string[];
  characterSheetUrl: string | null;           // the locked 2x2 likeness reference (skill Stage 2) — data URL
  musicIntent: 'lyric' | 'standard' | null;
  lockedDurationSeconds: number | null;
  beatCount: 8 | 12 | 16;
  targetMinutes: 1 | 2 | 3 | 4;
  aspectRatio: AspectId;
  pickType: 'curated' | 'custom' | null;
  curatorsPick: CuratorPickId | null;
  format: FormatId | null;
  themeCategory: ThemeCategoryId | null;
  theme: ThemeId | null;
  style: ArtStyleId | null;
  combinationPreviewUrl: string | null;       // Stage 3.5 "first look" render
  beatSheet: Beat[];
  beatSheetApproved: boolean;
  captionContainer: ContainerId | null;
  storyboardApproved: boolean;
  storyboardRerollRequests: number[];
  storyboardImages: Record<number, string>;  // beat index -> fal-generated frame URL
  beatVideos: Record<number, string>;        // beat index -> Seedance video URL
  captionCardImages: Record<number, string>;    // beat index -> caption-card PNG URL
  captionOverlayImages: Record<number, string>; // beat index -> transparent overlay PNG URL
  burnedBeatVideos: Record<number, string>;      // beat index -> caption-burned video URL
  assembledVideoUrl: string | null;
  musicBedUrl: string | null;
  musicBedDurationMs: number | null;
  narrationUrl: string | null;        // generated TTS voiceover — previewed + reused at compose
  narrationDurationMs: number | null; // probed duration of narrationUrl — forwarded to compose
  narrationScript: string | null;     // the text sent to TTS — forwarded to compose for subtitles
  narrationTimestamps: NarrationWord[] | null; // word-level timing from TTS — forwarded to compose
  words: WordsState;
  cardText: { opening: string; closing: string };
  cardPreviewImages: { opening: string | null; closing: string | null; caption: string | null };
  cardPreviewApproved: boolean;
  typographyLocked: ContainerId | null;
  dpStyle: DpStyleId;
  cinematographyBriefs: CinematographyBrief[];
  engineAdjustments: string[];
  cinematographyApproved: boolean;
  gateNotes: { characterSheet: string; storyboard: string; cinematography: string; cardPreview: string }; // free-text gate feedback — persisted so Back never drops it
  generationComplete: boolean;
  eulogyRequested: boolean;
}

export const initialState: BuilderState = {
  returningUser: null,
  petPhotos: [],
  petName: '',
  petNamePronunciation: '',
  gender: null,
  petProfile: null,
  memoryPromptType: null,
  memoryPromptAnswer: '',
  relationship: null,
  traits: [],
  favorites: [],
  creatorName: '',
  years: '',
  yearsIncluded: false,
  characterSheetApproved: false,
  characterSheetRefinements: [],
  characterSheetUrl: null,
  musicIntent: null,
  lockedDurationSeconds: null,
  beatCount: 12,
  targetMinutes: 3,
  aspectRatio: '9:16',
  pickType: null,
  curatorsPick: null,
  format: null,
  themeCategory: null,
  theme: null,
  style: null,
  combinationPreviewUrl: null,
  beatSheet: [],
  beatSheetApproved: false,
  captionContainer: null,
  storyboardApproved: false,
  storyboardRerollRequests: [],
  storyboardImages: {},
  beatVideos: {},
  captionCardImages: {},
  captionOverlayImages: {},
  burnedBeatVideos: {},
  assembledVideoUrl: null,
  musicBedUrl: null,
  musicBedDurationMs: null,
  narrationUrl: null,
  narrationDurationMs: null,
  narrationScript: null,
  narrationTimestamps: null,
  words: {
    opening: 'simple',
    openingCustom: ['', ''],
    closing: 'gratitude_simple_farewell',
    closingCustom: '',
    captions: [],
    music: 'silence',
    musicMode: 'ambient_only',
    musicPrompt: '',
    musicStyle: '',
    musicTitle: '',
    musicLyrics: '',
    musicProvider: null,
    musicApproved: true,
    musicGenerationStatus: 'idle',
    musicGenerationError: '',
    musicVariants: [],
    narration: 'off',
    narrationLetter: [],
    subtitles: true,
    reviewed: false,
  },
  cardText: { opening: '', closing: '' },
  cardPreviewImages: { opening: null, closing: null, caption: null },
  cardPreviewApproved: false,
  typographyLocked: null,
  dpStyle: 'none',
  cinematographyBriefs: [],
  engineAdjustments: [],
  cinematographyApproved: false,
  gateNotes: { characterSheet: '', storyboard: '', cinematography: '', cardPreview: '' },
  generationComplete: false,
  eulogyRequested: false,
};

export function resetDownstream(state: BuilderState, fromStage: StepId): Partial<BuilderState> {
  switch (fromStage) {
    case 'music_intent':
      return {
        lockedDurationSeconds: null,
        beatSheet: [],
        beatSheetApproved: false,
        storyboardApproved: false,
        storyboardImages: {},
        beatVideos: {},
        captionCardImages: {},
        captionOverlayImages: {},
        burnedBeatVideos: {},
        assembledVideoUrl: null,
        musicBedUrl: null,
        musicBedDurationMs: null,
        narrationUrl: null,
        narrationDurationMs: null,
        narrationScript: null,
        narrationTimestamps: null,
        cinematographyBriefs: [],
        cinematographyApproved: false,
        words: {
          ...state.words,
          musicVariants: [],
          musicApproved: false,
        },
      };
    case 'length_aspect':
      return {
        beatSheet: [],
        beatSheetApproved: false,
        storyboardApproved: false,
        storyboardImages: {},
        beatVideos: {},
        captionCardImages: {},
        captionOverlayImages: {},
        burnedBeatVideos: {},
        assembledVideoUrl: null,
        musicBedUrl: null,
        musicBedDurationMs: null,
        narrationUrl: null,
        narrationDurationMs: null,
        narrationScript: null,
        narrationTimestamps: null,
        cinematographyBriefs: [],
        cinematographyApproved: false,
      };
    case 'format':
    case 'theme':
    case 'style':
      return {
        combinationPreviewUrl: null,
        beatSheet: [],
        beatSheetApproved: false,
        captionContainer: null,
        storyboardApproved: false,
        storyboardImages: {},
        beatVideos: {},
        captionCardImages: {},
        captionOverlayImages: {},
        burnedBeatVideos: {},
        assembledVideoUrl: null,
        musicBedUrl: null,
        musicBedDurationMs: null,
        narrationUrl: null,
        narrationDurationMs: null,
        narrationScript: null,
        narrationTimestamps: null,
        cinematographyBriefs: [],
        cinematographyApproved: false,
        ...(fromStage === 'style' ? { cardPreviewApproved: false, typographyLocked: null, cardPreviewImages: { opening: null, closing: null, caption: null } } : {}),
      };
    case 'beatsheet':
      return {
        storyboardApproved: false,
        storyboardImages: {},
        beatVideos: {},
        captionCardImages: {},
        captionOverlayImages: {},
        burnedBeatVideos: {},
        assembledVideoUrl: null,
        musicBedUrl: null,
        musicBedDurationMs: null,
        narrationUrl: null,
        narrationDurationMs: null,
        narrationScript: null,
        narrationTimestamps: null,
        cinematographyBriefs: [],
        cinematographyApproved: false,
      };
    case 'words':
      return {
        storyboardImages: {},
        storyboardApproved: false,
        cardPreviewImages: { opening: null, closing: null, caption: null },
        cardPreviewApproved: false,
        cinematographyBriefs: [],
        cinematographyApproved: false,
        musicBedUrl: null,
        musicBedDurationMs: null,
        words: {
          ...state.words,
          musicVariants: [],
          musicApproved: false,
        },
      };
    default:
      return {};
  }
}

// PreviewContext — exposes preview mode flag to any stage that needs to gate generation.
export const PreviewContext = createContext<boolean>(false);

export function usePreviewMode(): boolean {
  return useContext(PreviewContext);
}

interface BuilderContextValue {
  state: BuilderState;
  update: (patch: Partial<BuilderState>) => void;
  resetDownstream: (fromStage: StepId) => void;
}

export const BuilderContext = createContext<BuilderContextValue | null>(null);

export function BuilderProvider({
  children,
  seed,
  isPreview = false,
}: {
  children: React.ReactNode;
  seed?: BuilderState;
  // Preview mode (gates generation) is now EXPLICIT — decoupled from `seed` so a
  // resumed draft can hydrate state WITHOUT entering preview mode.
  isPreview?: boolean;
}) {
  // Merge the seed OVER initialState so a resumed draft saved before a field
  // existed still gets that field's default (avoids undefined-field crashes on
  // resume after the schema grows). Shallow merge — covers top-level additions.
  const [state, setState] = useState<BuilderState>(
    seed ? { ...initialState, ...seed } : initialState,
  );

  const update = (patch: Partial<BuilderState>) => setState(s => ({ ...s, ...patch }));

  const resetDs = (fromStage: StepId) => {
    setState(s => ({ ...s, ...resetDownstream(s, fromStage) }));
  };

  return React.createElement(
    PreviewContext.Provider,
    { value: isPreview },
    React.createElement(
      BuilderContext.Provider,
      { value: { state, update, resetDownstream: resetDs } },
      children,
    ),
  );
}

export function useBuilder(): BuilderContextValue {
  const ctx = useContext(BuilderContext);
  if (!ctx) throw new Error('useBuilder must be used inside BuilderProvider');
  return ctx;
}

export interface StageProps {
  onNext: () => void;
  onBack: () => void;
  goToStep: (id: StepId) => void;
}
