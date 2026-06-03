"use client";

import React, { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react';
import { useBuilder } from '../state';
import { WizardFooterContext } from './footerSlot';
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
  MusicIntent,
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
  // opts.preserve = jump without the downstream reset (e.g. to edit the song
  // without discarding the storyboard / clips / cards).
  goToStep: (id: StepId, opts?: { preserve?: boolean }) => void;
  // True when the current step was reached by going BACK (or a backward jump).
  // Lets a multi-sub-step stage (e.g. TheWords) open at its LAST sub-step on the
  // backward path instead of its first — otherwise back-nav skips the tail
  // sub-steps (music / narration / review).
  enteredViaBack: boolean;
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

  // Track the last navigation direction so a stage can open at the right end on
  // mount. It's state (not a ref) so it's safe to read during render and batches
  // into the same re-render as setStepIndex. stepIndexRef mirrors stepIndex so
  // goToStep can compare against the current step from inside a stable callback.
  const [enteredViaBack, setEnteredViaBack] = useState(false);
  const stepIndexRef = useRef(initialStepIndex);
  useEffect(() => { stepIndexRef.current = stepIndex; }, [stepIndex]);

  const next = useCallback(() => {
    setEnteredViaBack(false);
    setStepIndex(i => {
      const ni = Math.min(STEPS.length - 1, i + 1);
      setFurthestReached(f => Math.max(f, ni));
      return ni;
    });
  }, []);

  const back = useCallback(() => {
    setEnteredViaBack(true);
    setStepIndex(current => {
      const target = Math.max(0, current - 1);
      if (target < current) {
        resetDownstream(STEPS[target].id);
      }
      return target;
    });
  }, [resetDownstream]);

  const goToStep = useCallback((id: StepId, opts?: { preserve?: boolean }) => {
    const target = STEPS.findIndex(s => s.id === id);
    if (target < 0) return;
    setEnteredViaBack(target < stepIndexRef.current);
    setStepIndex(current => {
      // preserve = a non-destructive jump (keeps storyboard/clips/cards) — used
      // to edit the song without re-running the whole tail.
      if (target < current && !opts?.preserve) {
        resetDownstream(STEPS[target].id);
      }
      setFurthestReached(f => Math.max(f, target));
      return target;
    });
  }, [resetDownstream]);

  return (
    <WizardContext.Provider
      value={{ stepIndex, furthestReached, next, back, goToStep, enteredViaBack }}
    >
      {children}
    </WizardContext.Provider>
  );
}

export default function Wizard() {
  const { stepIndex, next, back, goToStep, enteredViaBack } = useWizard();
  const props: StageProps = { onNext: next, onBack: back, goToStep, enteredViaBack };
  const currentId = STEPS[stepIndex].id;

  // Single internal scroll region (the page itself never scrolls in the locked
  // shell). Reset it to the top on every step change so the user lands at the
  // top of the next step. The footer slot is a callback-ref into state so
  // StageShell can portal its action bar into the locked row below the scroll.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [footerEl, setFooterEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [stepIndex]);

  return (
    <WizardFooterContext.Provider value={footerEl}>
      <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', width: '100%' }}>
        <div
          ref={scrollRef}
          className="builder-scroll"
          style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', width: '100%' }}
        >
          <main style={{ maxWidth: 980, margin: '0 auto', padding: '32px 24px 48px' }}>
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
                case 'music_intent':      return <MusicIntent {...props} />;
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
        </div>
        {/* Locked bottom row — StageShell portals its Back/Continue bar here so
            it stays pinned at the viewport bottom while content scrolls above. */}
        <div ref={setFooterEl} style={{ flex: '0 0 auto' }} />
      </div>
    </WizardFooterContext.Provider>
  );
}
