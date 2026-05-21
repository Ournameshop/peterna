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

export interface WordsState {
  opening: string;
  openingCustom: [string, string];
  closing: string;
  closingCustom: string;
  captions: { beatIndex: number; text: string }[];
  music: string;
  narration: 'off' | string;
  narrationLetter: string[];
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
  beatCount: 8 | 12 | 16;
  targetMinutes: 2 | 3 | 4;
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
  captionCardImages: Record<number, string>; // beat index -> gpt-image-2 caption-card URL
  assembledVideoUrl: string | null;
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
  assembledVideoUrl: null,
  words: {
    opening: 'simple',
    openingCustom: ['', ''],
    closing: 'gratitude_simple_farewell',
    closingCustom: '',
    captions: [],
    music: 'silence',
    narration: 'off',
    narrationLetter: [],
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
    case 'length_aspect':
      return {
        beatSheet: [],
        beatSheetApproved: false,
        storyboardApproved: false,
        storyboardImages: {},
        beatVideos: {},
        captionCardImages: {},
        assembledVideoUrl: null,
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
        assembledVideoUrl: null,
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
        assembledVideoUrl: null,
        cinematographyBriefs: [],
        cinematographyApproved: false,
      };
    default:
      return {};
  }
}

interface BuilderContextValue {
  state: BuilderState;
  update: (patch: Partial<BuilderState>) => void;
  patch: (patch: Partial<BuilderState>) => void;
  resetDownstream: (fromStage: StepId) => void;
}

export const BuilderContext = createContext<BuilderContextValue | null>(null);

export function BuilderProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BuilderState>(initialState);

  const update = (patch: Partial<BuilderState>) => setState(s => ({ ...s, ...patch }));

  const resetDs = (fromStage: StepId) => {
    const patch = resetDownstream(state, fromStage);
    setState(s => ({ ...s, ...patch }));
  };

  return React.createElement(
    BuilderContext.Provider,
    { value: { state, update, patch: update, resetDownstream: resetDs } },
    children,
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
