"use client";

import React from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { PALETTE } from '../lib/palette';
import { STEPS, STEP_GROUPS } from '../steps';
import type { StepId } from '../steps';
import { useBuilder } from '../state';
import type { BuilderState } from '../state';
import { useWizard } from './Wizard';

// Maps the gate step id to the BuilderState approval flag key
const GATE_APPROVED: Record<number, keyof BuilderState> = {
  1: 'characterSheetApproved',
  2: 'storyboardApproved',
  3: 'cinematographyApproved',
};

export default function ProgressRail() {
  const { stepIndex, furthestReached, goToStep } = useWizard();
  const { state } = useBuilder();

  const activeGroupId = STEPS[stepIndex].group;

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flex: 1,
        minWidth: 0,
      }}
      aria-label="Progress"
    >
      {STEP_GROUPS.map((group) => {
        const groupSteps = STEPS.filter(s => s.group === group.id);
        const firstStepIndex = STEPS.findIndex(s => s.group === group.id);
        const lastStepIndexInGroup = STEPS.map((s, i) => ({ s, i })).filter(({ s }) => s.group === group.id).at(-1)?.i ?? firstStepIndex;
        const isActive = group.id === activeGroupId;
        const isCompleted = lastStepIndexInGroup < stepIndex;
        const isFuture = firstStepIndex > stepIndex && !isActive;

        // Gate glyph: does any step in this group have a gate?
        const gateStep = groupSteps.find(s => s.gate);
        const gateNum = gateStep?.gate;
        const gateApproved = gateNum ? !!state[GATE_APPROVED[gateNum]] : false;

        // Intra-group fill: how many steps in this group are completed
        const completedInGroup = groupSteps.filter((_, localIdx) => {
          const globalIdx = firstStepIndex + localIdx;
          return globalIdx < stepIndex;
        }).length;
        const fillPct = groupSteps.length > 0
          ? Math.round((completedInGroup / groupSteps.length) * 100)
          : 0;

        const canClick = isCompleted && firstStepIndex <= furthestReached;
        const firstStepId = STEPS[firstStepIndex]?.id as StepId | undefined;

        const handleClick = () => {
          if (canClick && firstStepId) goToStep(firstStepId);
        };

        return (
          <button
            key={group.id}
            onClick={handleClick}
            disabled={!canClick}
            title={gateNum ? 'Approval step' : undefined}
            style={{
              background: 'none',
              border: 'none',
              padding: isActive ? '0 8px' : '0 4px',
              cursor: canClick ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              minWidth: isActive ? 120 : 'auto',
              flex: isActive ? '1 1 auto' : '0 0 auto',
              transition: 'all 250ms ease',
            }}
          >
            {/* Completed dot */}
            {isCompleted && !isActive && (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: PALETTE.brassDeep,
                  flexShrink: 0,
                  display: 'inline-block',
                }}
              />
            )}

            {/* Future dot */}
            {isFuture && !isActive && (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: PALETTE.parchmentLight,
                  flexShrink: 0,
                  display: 'inline-block',
                }}
              />
            )}

            {/* Active group: label + fill bar */}
            {isActive && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 11,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: PALETTE.espresso,
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {group.label}
                  </span>
                  {gateNum && (
                    <span
                      title="Approval step"
                      style={{ color: PALETTE.brassDeep, display: 'inline-flex', alignItems: 'center' }}
                    >
                      {gateApproved
                        ? <ShieldCheck size={12} />
                        : <Lock size={12} />
                      }
                    </span>
                  )}
                </div>
                <div
                  style={{
                    height: 2,
                    background: PALETTE.parchmentLight,
                    borderRadius: 1,
                    overflow: 'hidden',
                    width: '100%',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${fillPct}%`,
                      background: PALETTE.brass,
                      borderRadius: 1,
                      transition: 'width 300ms ease',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Completed group: label beside dot, gate glyph if applicable */}
            {isCompleted && !isActive && (
              <>
                <span
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 11,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: PALETTE.mute,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {group.label}
                </span>
                {gateNum && (
                  <span
                    title="Approval step"
                    style={{ color: PALETTE.brassDeep, display: 'inline-flex', alignItems: 'center' }}
                  >
                    {gateApproved
                      ? <ShieldCheck size={11} />
                      : <Lock size={11} />
                    }
                  </span>
                )}
              </>
            )}
          </button>
        );
      })}
    </nav>
  );
}
