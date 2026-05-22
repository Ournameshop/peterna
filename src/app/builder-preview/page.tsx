"use client";

import React from 'react';
import { PALETTE } from '../builder/lib/palette';
import { BuilderProvider } from '../builder/state';
import { WizardProvider, useWizard } from '../builder/shell/Wizard';
import TopBar from '../builder/shell/TopBar';
import Wizard from '../builder/shell/Wizard';
import { buildMockState } from '../builder/lib/mockState';
import { STEPS, STEP_GROUPS } from '../builder/steps';
import type { StepId } from '../builder/steps';

const BANNER_H = 34;

function StepNavigator() {
  const { stepIndex, goToStep } = useWizard();

  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        position: 'sticky',
        top: BANNER_H,
        height: `calc(100vh - ${BANNER_H}px)`,
        overflowY: 'auto',
        borderRight: `1px solid ${PALETTE.parchmentLight}`,
        background: PALETTE.boneSoft,
        padding: '16px 0',
      }}
    >
      {STEP_GROUPS.map(group => {
        const groupSteps = STEPS.filter(s => s.group === group.id);
        return (
          <div key={group.id} style={{ marginBottom: 8 }}>
            <div
              style={{
                padding: '4px 14px',
                fontSize: 9,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: PALETTE.mute,
                fontFamily: 'Inter, system-ui, sans-serif',
                fontWeight: 600,
              }}
            >
              {group.label}
            </div>
            {groupSteps.map(step => {
              const idx = STEPS.indexOf(step);
              const isActive = idx === stepIndex;
              return (
                <button
                  key={step.id}
                  onClick={() => goToStep(step.id as StepId)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '5px 14px',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontSize: 11,
                    letterSpacing: '0.01em',
                    background: isActive ? PALETTE.parchment : 'transparent',
                    color: isActive ? PALETTE.espresso : PALETTE.espressoSoft,
                    fontWeight: isActive ? 600 : 400,
                    borderLeft: isActive ? `3px solid ${PALETTE.brass}` : '3px solid transparent',
                  }}
                >
                  <span style={{ color: PALETTE.mute, marginRight: 6, fontSize: 10 }}>
                    {step.skillStage}
                  </span>
                  {step.id.replace(/_/g, ' ')}
                </button>
              );
            })}
          </div>
        );
      })}
    </aside>
  );
}

const mockState = buildMockState();

export default function BuilderPreviewPage() {
  return (
    <BuilderProvider seed={mockState}>
      <WizardProvider>
        <div style={{ minHeight: '100vh', background: PALETTE.bone, color: PALETTE.espresso }}>
          {/* Banner */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 9999,
              height: BANNER_H,
              background: '#1a1a1a',
              color: '#f5c842',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            PREVIEW MODE &middot; mock data &mdash; no API calls are made
          </div>

          {/* Body offset by banner */}
          <div style={{ paddingTop: BANNER_H, display: 'flex' }}>
            <StepNavigator />
            <div style={{ flex: 1, minWidth: 0 }}>
              <TopBar />
              <Wizard />
            </div>
          </div>
        </div>
      </WizardProvider>
    </BuilderProvider>
  );
}
