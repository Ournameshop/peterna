"use client";

import React, { useState, createContext, useContext, useCallback } from 'react';
import { useBuilder } from '../state';
import { STEPS } from '../steps';
import type { StepId } from '../steps';
import type { StageProps } from '../state';
import {
  Welcome,
  ReturningUser,
  Photos,
  NameGender,
  VisionConfirm,
  MemoryRelationship,
  TraitsFavorites,
  CreatorYears,
  CharacterSheet,
  LengthAspect,
  CuratorsPicks,
  StyleConfirm,
  FormatPick,
  ThemePick,
  StylePick,
  CombinationPreview,
  BeatSheet,
  CaptionContainer,
  Storyboard,
  TheWords,
  CardPreview,
  Cinematography,
  Generate,
  FinishedTribute,
} from '../stages';

export interface WizardContextValue {
  stepIndex: number;
  furthestReached: number;
  next: () => void;
  back: () => void;
  goToStep: (id: StepId) => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizard must be inside WizardProvider');
  return ctx;
}

export function WizardProvider({ children, initialStepIndex = 0 }: { children: React.ReactNode; initialStepIndex?: number }) {
  const [stepIndex, setStepIndex] = useState(initialStepIndex);
  const [furthestReached, setFurthestReached] = useState(initialStepIndex);
  const { resetDownstream } = useBuilder();

  const next = useCallback(() => {
    setStepIndex(i => {
      const ni = Math.min(STEPS.length - 1, i + 1);
      setFurthestReached(f => Math.max(f, ni));
      return ni;
    });
  }, []);

  const back = useCallback(() => {
    setStepIndex(current => {
      const target = Math.max(0, current - 1);
      if (target < current) {
        resetDownstream(STEPS[target].id);
      }
      return target;
    });
  }, [resetDownstream]);

  const goToStep = useCallback((id: StepId) => {
    const target = STEPS.findIndex(s => s.id === id);
    if (target < 0) return;
    setStepIndex(current => {
      if (target < current) {
        resetDownstream(STEPS[target].id);
      }
      setFurthestReached(f => Math.max(f, target));
      return target;
    });
  }, [resetDownstream]);

  return (
    <WizardContext.Provider value={{ stepIndex, furthestReached, next, back, goToStep }}>
      {children}
    </WizardContext.Provider>
  );
}

export default function Wizard() {
  const { stepIndex, next, back, goToStep } = useWizard();
  const props: StageProps = { onNext: next, onBack: back, goToStep };
  const currentId = STEPS[stepIndex].id;

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '32px 24px 96px' }}>
      {(() => {
        switch (currentId) {
          case 'welcome':           return <Welcome {...props} />;
          case 'returning':         return <ReturningUser {...props} />;
          case 'photos':            return <Photos {...props} />;
          case 'name_gender':       return <NameGender {...props} />;
          case 'vision':            return <VisionConfirm {...props} />;
          case 'memory_rel':        return <MemoryRelationship {...props} />;
          case 'traits_fav':        return <TraitsFavorites {...props} />;
          case 'creator_years':     return <CreatorYears {...props} />;
          case 'character':         return <CharacterSheet {...props} />;
          case 'length_aspect':     return <LengthAspect {...props} />;
          case 'curators':          return <CuratorsPicks {...props} />;
          case 'style_confirm':     return <StyleConfirm {...props} />;
          case 'format':            return <FormatPick {...props} />;
          case 'theme':             return <ThemePick {...props} />;
          case 'style':             return <StylePick {...props} />;
          case 'combo_preview':     return <CombinationPreview {...props} />;
          case 'beatsheet':         return <BeatSheet {...props} />;
          case 'caption_container': return <CaptionContainer {...props} />;
          case 'storyboard':        return <Storyboard {...props} />;
          case 'words':             return <TheWords {...props} />;
          case 'card_preview':      return <CardPreview {...props} />;
          case 'cinematography':    return <Cinematography {...props} />;
          case 'generate':          return <Generate {...props} />;
          case 'finished':          return <FinishedTribute {...props} />;
          default:                  return null;
        }
      })()}
    </main>
  );
}
