"use client";

import React, { useEffect, useState } from 'react';
import { PALETTE } from '../lib/palette';
import { GateReview, Sans, Eyebrow } from '../lib/primitives';
import { useBuilder } from '../state';
import type { StageProps } from './types';
import type { CinematographyBrief, DpStyleId } from '../state';
import { dpStyleLibrary } from '@/lib/peternal-library';
import { runCinematographyEngine } from '@/lib/peternal-cinematography';

const BRIEF_COLS: { key: keyof CinematographyBrief; label: string }[] = [
  { key: 'beatIndex', label: '#' },
  { key: 'lensMm', label: 'Lens' },
  { key: 'lensCharacter', label: 'Character' },
  { key: 'cameraMove', label: 'Move' },
  { key: 'moveIntensity', label: 'Intensity' },
  { key: 'subjectMotion', label: 'Subject' },
  { key: 'lightingMotion', label: 'Lighting' },
  { key: 'dofBehavior', label: 'DOF' },
  { key: 'shotStructure', label: 'Shot' },
  { key: 'ambientAudio', label: 'Audio' },
];

function displayValue(key: keyof CinematographyBrief, val: CinematographyBrief[typeof key]): string {
  if (key === 'beatIndex') return String((val as number) + 1);
  if (key === 'lensMm') return `${val}mm`;
  return String(val).replace(/_/g, ' ');
}

// Simple per-field picker options
const FIELD_OPTIONS: Partial<Record<keyof CinematographyBrief, string[]>> = {
  cameraMove: [
    'locked_off', 'slow_push', 'slow_pull', 'slow_rise', 'slow_fall',
    'slow_pan_L', 'slow_pan_R', 'slow_orbit', 'parallax_dolly', 'handheld_float', 'dreamy_drift',
  ],
  moveIntensity: ['barely_perceptible', 'gentle', 'pronounced'],
  subjectMotion: ['locked', 'breath_only', 'loop_idle', 'loop_action', 'one_shot_action'],
  lightingMotion: ['static', 'drifting_sunbeam', 'leaf_dapple_breeze', 'candle_flicker', 'dust_motes', 'rim_light_pulse'],
  dofBehavior: ['locked_shallow', 'locked_deep', 'rack_to_subject', 'rack_to_environment', 'rack_to_caption'],
  shotStructure: ['single_sustained', 'two_shot_cut', 'three_shot_montage'],
  ambientAudio: ['birdsong', 'wind_grass', 'hearth_crackle', 'soft_rain', 'water_lapping', 'silence', 'breath_only'],
  audioIntensity: ['bed_only', 'present', 'forward'],
  lensMm: ['24', '35', '50', '85', '105'],
};

export default function Cinematography({ onNext, onBack }: StageProps) {
  const { state, update } = useBuilder();
  const [editing, setEditing] = useState<{ beatIndex: number; field: keyof CinematographyBrief } | null>(null);
  const [adjustMode, setAdjustMode] = useState(false);

  // On mount: if briefs are empty, run the engine
  useEffect(() => {
    if (state.cinematographyBriefs.length === 0) {
      const { briefs, adjustments } = runCinematographyEngine(state);
      update({ cinematographyBriefs: briefs, engineAdjustments: adjustments });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDpChange(dp: DpStyleId) {
    update({ dpStyle: dp });
    const { briefs, adjustments } = runCinematographyEngine({ ...state, dpStyle: dp });
    update({ cinematographyBriefs: briefs, engineAdjustments: adjustments });
  }

  function handleRegenerate() {
    const { briefs, adjustments } = runCinematographyEngine(state);
    update({ cinematographyBriefs: briefs, engineAdjustments: adjustments });
    setEditing(null);
  }

  function patchBrief(beatIndex: number, field: keyof CinematographyBrief, rawVal: string) {
    const next = state.cinematographyBriefs.map((b) => {
      if (b.beatIndex !== beatIndex) return b;
      let val: CinematographyBrief[typeof field];
      if (field === 'lensMm') {
        val = Number(rawVal) as CinematographyBrief['lensMm'];
      } else if (field === 'beatIndex') {
        val = Number(rawVal) as number;
      } else {
        val = rawVal as never;
      }
      return { ...b, [field]: val };
    });
    update({ cinematographyBriefs: next });
    setEditing(null);
  }

  const briefs = state.cinematographyBriefs;
  const adjustments = state.engineAdjustments;
  const loading = briefs.length === 0;

  return (
    <GateReview
      eyebrow="Gate 3 · Cinematography"
      title={<>Here is the <em>cinematography plan</em>.</>}
      lede={`${briefs.length || state.beatCount} scenes, shot by shot. Every lens, move, and lighting choice has been derived from the story.`}
      options={[
        { id: 'approve', label: 'Approve and start generation', tone: 'primary' },
        { id: 'adjust', label: 'Adjust a scene' },
        { id: 'dp', label: 'Apply a different DP style' },
        { id: 'regenerate', label: 'Regenerate the whole brief' },
      ]}
      onSelect={(id) => {
        if (id === 'approve') {
          update({ cinematographyApproved: true });
          onNext();
        } else if (id === 'adjust') {
          setAdjustMode(true);
        } else if (id === 'dp') {
          setAdjustMode(false);
        } else if (id === 'regenerate') {
          handleRegenerate();
        }
      }}
      correctionLabel="Notes for the cinematographer (optional)"
      correctionValue={state.gateNotes.cinematography}
      onCorrectionChange={v => update({ gateNotes: { ...state.gateNotes, cinematography: v } })}
      onBack={onBack}
    >
      {/* DP style picker */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ marginBottom: 12 }}><Eyebrow>DP Style</Eyebrow></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {dpStyleLibrary.map((dp) => {
            const active = state.dpStyle === dp.id;
            return (
              <button
                key={dp.id}
                onClick={() => handleDpChange(dp.id as DpStyleId)}
                style={{
                  padding: '8px 16px',
                  border: `1px solid ${active ? PALETTE.espresso : PALETTE.parchmentLight}`,
                  background: active ? PALETTE.boneSoft : 'white',
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 13,
                  color: PALETTE.espresso,
                  transition: 'all 180ms ease',
                }}
              >
                {dp.name}
              </button>
            );
          })}
        </div>
        {state.dpStyle !== 'none' && (
          <Sans style={{ fontSize: 12, color: PALETTE.mute, marginTop: 8, fontStyle: 'italic' }}>
            {dpStyleLibrary.find((d) => d.id === state.dpStyle)?.bias}
          </Sans>
        )}
      </div>

      {loading ? (
        <div
          style={{
            padding: '40px 0',
            textAlign: 'center',
            color: PALETTE.mute,
            fontFamily: 'Inter, sans-serif',
            fontSize: 14,
          }}
        >
          Deriving cinematography plan…
        </div>
      ) : (
        <>
          {/* Brief table */}
          <div style={{ overflowX: 'auto', marginBottom: 24 }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontFamily: 'Inter, sans-serif',
                fontSize: 12,
              }}
            >
              <thead>
                <tr>
                  {BRIEF_COLS.map((col) => (
                    <th
                      key={col.key}
                      style={{
                        textAlign: 'left',
                        padding: '8px 10px',
                        borderBottom: `1px solid ${PALETTE.parchmentLight}`,
                        color: PALETTE.mute,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        fontWeight: 500,
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                  {adjustMode && (
                    <th
                      style={{
                        padding: '8px 10px',
                        borderBottom: `1px solid ${PALETTE.parchmentLight}`,
                      }}
                    />
                  )}
                </tr>
              </thead>
              <tbody>
                {briefs.map((brief) => (
                  <tr
                    key={brief.beatIndex}
                    style={{
                      background: brief.beatIndex % 2 === 0 ? 'white' : PALETTE.boneSoft,
                    }}
                  >
                    {BRIEF_COLS.map((col) => {
                      const isEditing =
                        adjustMode &&
                        editing?.beatIndex === brief.beatIndex &&
                        editing?.field === col.key;
                      const options = FIELD_OPTIONS[col.key];
                      return (
                        <td
                          key={col.key}
                          style={{
                            padding: '8px 10px',
                            borderBottom: `1px solid ${PALETTE.parchmentLight}`,
                            color: PALETTE.espresso,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isEditing && options ? (
                            <select
                              defaultValue={String(brief[col.key])}
                              onChange={(e) => patchBrief(brief.beatIndex, col.key, e.target.value)}
                              autoFocus
                              onBlur={() => setEditing(null)}
                              style={{
                                fontFamily: 'Inter, sans-serif',
                                fontSize: 12,
                                border: `1px solid ${PALETTE.brass}`,
                                borderRadius: 2,
                                padding: '2px 4px',
                                background: 'white',
                                color: PALETTE.espresso,
                              }}
                            >
                              {options.map((o) => (
                                <option key={o} value={o}>
                                  {o.replace(/_/g, ' ')}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span
                              onClick={() =>
                                adjustMode && options && col.key !== 'beatIndex'
                                  ? setEditing({ beatIndex: brief.beatIndex, field: col.key })
                                  : undefined
                              }
                              style={{
                                cursor:
                                  adjustMode && options && col.key !== 'beatIndex'
                                    ? 'pointer'
                                    : 'default',
                                textDecoration:
                                  adjustMode && options && col.key !== 'beatIndex'
                                    ? 'underline'
                                    : 'none',
                                textDecorationStyle: 'dotted',
                                textUnderlineOffset: 3,
                                color:
                                  adjustMode && options && col.key !== 'beatIndex'
                                    ? PALETTE.brassDeep
                                    : PALETTE.espresso,
                              }}
                            >
                              {displayValue(col.key, brief[col.key])}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    {adjustMode && (
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid ${PALETTE.parchmentLight}` }}>
                        <Sans style={{ fontSize: 10, color: PALETTE.mute }}>tap field</Sans>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Engine adjustments log */}
          {adjustments.length > 0 && (
            <div
              style={{
                background: PALETTE.boneSoft,
                border: `1px solid ${PALETTE.parchmentLight}`,
                borderRadius: 4,
                padding: '16px 20px',
              }}
            >
              <div style={{ marginBottom: 10 }}><Eyebrow>Engine adjustments</Eyebrow></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {adjustments.map((adj, i) => (
                  <Sans
                    key={i}
                    style={{ fontSize: 12, color: PALETTE.mute, lineHeight: 1.5 }}
                  >
                    {adj}
                  </Sans>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </GateReview>
  );
}
