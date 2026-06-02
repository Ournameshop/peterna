"use client";

import React, { useState } from 'react';
import { PALETTE } from '../lib/palette';
import { Sans, Pill, StageShell, FieldGroup, SELECTED_BORDER, SELECTED_RING } from '../lib/primitives';
import { useBuilder } from '../state';
import { memoryPrompts, relationships } from '@/lib/peternal-library';
import type { StageProps } from './types';
import type { RelationshipId } from '../state';
import { defaultOpeningArchetypeFor } from '@/lib/peternal-resolvers';

export default function MemoryRelationship({ onNext, onBack }: StageProps) {
  const { state, update } = useBuilder();
  const [promptId, setPromptId] = useState<string | null>(state.memoryPromptType);
  const [promptAnswer, setPromptAnswer] = useState(state.memoryPromptAnswer);
  const [skippedPrompt, setSkippedPrompt] = useState(state.memoryPromptType === null && state.memoryPromptAnswer === '' ? false : state.memoryPromptType === null);
  const [rel, setRel] = useState<RelationshipId | null>(state.relationship);
  // Capture the opening value at mount to detect whether user has already deviated from default.
  const [initialOpening] = useState(state.words.opening);

  const name = state.petName || 'your pet';

  function selectPrompt(id: string) {
    if (id === 'skip') {
      setPromptId(null);
      setSkippedPrompt(true);
      setPromptAnswer('');
      update({ memoryPromptType: null, memoryPromptAnswer: '' });
    } else {
      setPromptId(id);
      setSkippedPrompt(false);
      // Commit the prompt choice immediately — otherwise selecting a prompt but
      // not yet typing an answer would be lost on Back (only handleAnswerChange
      // committed it before).
      update({ memoryPromptType: id });
    }
  }

  function handleAnswerChange(val: string) {
    setPromptAnswer(val);
    update({ memoryPromptType: promptId, memoryPromptAnswer: val });
  }

  function handleRelChange(id: RelationshipId) {
    setRel(id);
    // Seed opening archetype from relationship only if user hasn't manually chosen
    // (i.e. still on the initial default 'simple').
    const patch: Parameters<typeof update>[0] = { relationship: id };
    if (state.words.opening === 'simple' || state.words.opening === initialOpening) {
      patch.words = { ...state.words, opening: defaultOpeningArchetypeFor(id) };
    }
    update(patch);
  }

  const activePrompt = memoryPrompts.find(p => p.id === promptId);
  const resolvedLabel = (label: string) => label.replace('[PET_NAME]', name);

  return (
    <StageShell
      eyebrow="Memory &amp; Relationship"
      title="Tell us a little more"
      lede="A memory and a sense of who they were to you. Both are completely optional — skip either one."
      onNext={onNext}
      onBack={onBack}
      canNext={true}
      nextLabel="Continue"
    >
      {/* Section 1: Memory prompt */}
      <FieldGroup label="A memory of them">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {memoryPrompts.map(p => (
            <Pill
              key={p.id}
              active={promptId === p.id}
              onClick={() => selectPrompt(p.id)}
            >
              {resolvedLabel(p.label)}
            </Pill>
          ))}
          <Pill
            active={skippedPrompt}
            onClick={() => selectPrompt('skip')}
          >
            Skip
          </Pill>
        </div>

        {promptId && !skippedPrompt && activePrompt && (
          <div style={{ marginTop: 8 }}>
            <textarea
              value={promptAnswer}
              onChange={e => handleAnswerChange(e.target.value)}
              placeholder={resolvedLabel(activePrompt.placeholder)}
              rows={3}
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
                outline: 'none',
                lineHeight: 1.5,
              }}
            />
          </div>
        )}
      </FieldGroup>

      {/* Section 2: Relationship */}
      <FieldGroup label="Who were they to you?">
        <Sans style={{ fontSize: 13, color: PALETTE.mute, marginBottom: 14, lineHeight: 1.5 }}>
          This helps us choose the right tone. You can skip this too.
        </Sans>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {relationships.map(r => (
            <button
              key={r.id}
              onClick={() => handleRelChange(r.id as RelationshipId)}
              style={{
                textAlign: 'left',
                padding: '12px 16px',
                border: rel === r.id ? SELECTED_BORDER : `1px solid ${PALETTE.parchmentLight}`,
                background: rel === r.id ? PALETTE.boneSoft : 'transparent',
                boxShadow: rel === r.id ? SELECTED_RING : 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                fontSize: 14,
                color: rel === r.id ? PALETTE.espresso : PALETTE.mute,
                transition: 'all 180ms ease',
              }}
              onMouseEnter={e => {
                if (rel !== r.id) (e.currentTarget as HTMLButtonElement).style.borderColor = PALETTE.brass;
              }}
              onMouseLeave={e => {
                if (rel !== r.id) (e.currentTarget as HTMLButtonElement).style.borderColor = PALETTE.parchmentLight;
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        {!rel && (
          <Sans style={{ fontSize: 12, color: PALETTE.mute, marginTop: 14, fontStyle: 'italic' }}>
            No selection is fine — we&apos;ll keep the tone warm and gentle.
          </Sans>
        )}
      </FieldGroup>
    </StageShell>
  );
}
