"use client";

import React, { useState } from 'react';
import { PALETTE } from '../lib/palette';
import { Serif, Sans, Eyebrow, PrimaryButton } from '../lib/primitives';
import { ArrowRight, FolderClock } from 'lucide-react';
import type { StageProps } from './types';
import BuildsModal from '../shell/BuildsModal';

const lines = [
  "I'm so glad you're here. Let's make something beautiful together.",
  "Before we begin — I won't ask you about their last day, or how they passed. If you ever want to share that, you can, but I'll never push for it.",
  "We'll go slowly, one question at a time. Every step is skippable. You can redo anything as many times as you need — there's no rush, and nothing here is permanent until you say it is.",
  "Ready when you are.",
];

export default function Welcome({ onNext }: StageProps) {
  const [showBuilds, setShowBuilds] = useState(false);
  return (
    <section style={{ paddingTop: 48 }}>
      {showBuilds && <BuildsModal onClose={() => setShowBuilds(false)} />}
      <div style={{ maxWidth: 620, margin: '0 auto', textAlign: 'left' }}>
        <Eyebrow>A gentle beginning</Eyebrow>
        <Serif as="h1" italic style={{ fontSize: 'clamp(40px, 5.5vw, 64px)', lineHeight: 1.05, marginTop: 18, color: PALETTE.espresso, letterSpacing: '-0.015em' }}>
          A tribute, made with care.
        </Serif>
        <div style={{ marginTop: 32, borderLeft: `2px solid ${PALETTE.brass}`, paddingLeft: 24 }}>
          {lines.map((line, i) => (
            <Serif key={i} style={{ fontSize: 22, lineHeight: 1.55, color: PALETTE.espressoSoft, marginBottom: 18, animation: `fadeUp 600ms ease ${i * 220}ms both` }}>
              {line}
            </Serif>
          ))}
        </div>
        <div style={{ marginTop: 40, animation: 'fadeUp 600ms ease 1200ms both' }}>
          <PrimaryButton onClick={onNext}>
            I&apos;m ready <ArrowRight size={16} />
          </PrimaryButton>
          <Sans style={{ display: 'inline-block', marginLeft: 18, fontSize: 13, color: PALETTE.mute, fontStyle: 'italic' }}>
            takes about 8 minutes
          </Sans>
        </div>
        <div style={{ marginTop: 20, animation: 'fadeUp 600ms ease 1350ms both' }}>
          <button
            onClick={() => setShowBuilds(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              background: 'transparent',
              border: 'none',
              color: PALETTE.espressoSoft,
              fontFamily: 'Inter, sans-serif',
              fontSize: 14,
              cursor: 'pointer',
              textDecoration: 'underline',
              textUnderlineOffset: 4,
              padding: 0,
            }}
          >
            <FolderClock size={15} /> Continue a saved tribute
          </button>
        </div>
      </div>
      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>
    </section>
  );
}
