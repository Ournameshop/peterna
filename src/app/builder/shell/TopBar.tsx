"use client";

import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { PALETTE } from '../lib/palette';
import { Serif, Sans } from '../lib/primitives';
import ProgressRail from './ProgressRail';
import { useWizard } from './Wizard';

export default function TopBar() {
  const { back, stepIndex } = useWizard();
  return (
    <header
      style={{
        borderBottom: `1px solid ${PALETTE.parchmentLight}`,
        background: PALETTE.bone,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {stepIndex > 0 && (
            <button
              onClick={back}
              aria-label="Back"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'transparent',
                border: `1px solid ${PALETTE.parchmentLight}`,
                borderRadius: 999,
                padding: '5px 12px',
                color: PALETTE.espresso,
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <ChevronLeft size={15} /> Back
            </button>
          )}
          <Serif style={{ fontSize: 24, letterSpacing: '-0.01em' }}>Peterna</Serif>
          <Sans
            style={{
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: PALETTE.brass,
            }}
          >
            Tribute Builder
          </Sans>
        </div>
        <ProgressRail />
      </div>
    </header>
  );
}
