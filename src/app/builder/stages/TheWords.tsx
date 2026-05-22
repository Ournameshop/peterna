"use client";

import React, { useState } from 'react';
import { Check, Play } from 'lucide-react';
import { PALETTE } from '../lib/palette';
import {
  StageShell,
  GateReview,
  Serif,
  Sans,
  Eyebrow,
  FieldGroup,
  SummaryItem,
} from '../lib/primitives';
import { Waveform } from '../art';
import { useBuilder } from '../state';
import type { StageProps } from './types';
import {
  openingArchetypes,
  closingArchetypes,
  captionTemplates,
  narrationVoices,
  narrationQuestions,
} from '@/lib/peternal-library';
import { resolveArchetype, resolveText, musicTracksFor, captionVoiceFor } from '@/lib/peternal-resolvers';

const NARRATION_QUESTIONS = narrationQuestions;

const SUB_STEPS = ['Opening', 'Closing', 'Captions', 'Music', 'Narration', 'Review'];

function groupBy<T>(arr: readonly T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

export default function TheWords({ onNext, onBack }: StageProps) {
  const { state, update } = useBuilder();
  const [sub, setSub] = useState(0);
  const [customLine1, setCustomLine1] = useState(state.words.openingCustom[0]);
  const [customLine2, setCustomLine2] = useState(state.words.openingCustom[1]);
  const [customClosing, setCustomClosing] = useState(state.words.closingCustom);
  const [narrationAnswers, setNarrationAnswers] = useState<string[]>(
    state.words.narrationLetter.length === narrationQuestions.length
      ? state.words.narrationLetter
      : Array(narrationQuestions.length).fill(''),
  );

  const gender = state.gender ?? 'neutral';
  const petName = state.petName || 'them';
  const ctx = { gender, petName };

  const openingGroups = groupBy(openingArchetypes, (a) => a.group);
  const closingGroups = groupBy(closingArchetypes, (a) => a.group);

  const theme = state.theme ?? 'rainbow_bridge';
  const artStyle = state.style ?? 'cinematic_realism';
  const musicOptions = musicTracksFor(theme, artStyle);

  const captionKeys = Object.keys(captionTemplates).filter((k) => k !== 'custom');
  const captionSuggestions = captionKeys.flatMap((key) =>
    (captionTemplates[key] ?? []).slice(0, 1).map((t) => ({
      key,
      text: resolveText(t, ctx),
    })),
  ).slice(0, 6);

  const beatCount = state.beatCount;
  const beatIndices = Array.from({ length: beatCount }, (_, i) => i);

  function setOpening(id: string) {
    update({
      words: {
        ...state.words,
        opening: id,
        openingCustom: [customLine1, customLine2],
      },
    });
  }

  function setClosing(id: string) {
    update({ words: { ...state.words, closing: id, closingCustom: customClosing } });
  }

  function toggleCaption(beatIndex: number, text: string) {
    const existing = state.words.captions.find((c) => c.beatIndex === beatIndex);
    let next = state.words.captions.filter((c) => c.beatIndex !== beatIndex);
    if (!existing) {
      if (next.length < 3) next = [...next, { beatIndex, text }];
    }
    update({ words: { ...state.words, captions: next } });
  }

  function setMusic(id: string) {
    update({ words: { ...state.words, music: id } });
  }

  function setNarration(id: string) {
    if (id === state.words.narration) return;
    update({
      words: { ...state.words, narration: id },
      narrationUrl: null,
      narrationDurationMs: null,
      narrationScript: null,
      narrationTimestamps: null,
      assembledVideoUrl: null,
    });
  }

  function setSubtitles(on: boolean) {
    if (on === state.words.subtitles) return;
    update({ words: { ...state.words, subtitles: on }, assembledVideoUrl: null });
  }

  function advance() {
    if (sub < SUB_STEPS.length - 1) setSub(sub + 1);
  }
  function retreat() {
    if (sub > 0) setSub(sub - 1);
    else onBack();
  }

  // 5.5.1 — Opening
  if (sub === 0) {
    return (
      <StageShell
        eyebrow="The Words"
        title={<>How should it <em>open</em>?</>}
        lede="The first words your tribute shows. Pick one or write your own — every option works."
        onNext={advance}
        onBack={retreat}
        canNext={true}
        nextLabel="Next: Closing"
      >
        {Object.entries(openingGroups).map(([group, archetypes]) => (
          <div key={group} style={{ marginBottom: 28 }}>
            <div style={{ marginBottom: 12 }}><Eyebrow>{group}</Eyebrow></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {archetypes.map((a) => {
                const isCustom = a.id === 'custom';
                const active = state.words.opening === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setOpening(a.id)}
                    style={{
                      padding: '10px 18px',
                      border: `1px solid ${active ? PALETTE.espresso : PALETTE.parchmentLight}`,
                      background: active ? PALETTE.boneSoft : 'white',
                      borderRadius: 999,
                      cursor: 'pointer',
                      fontFamily: '"Cormorant Garamond", serif',
                      fontSize: 16,
                      fontStyle: 'italic',
                      color: PALETTE.espresso,
                      transition: 'all 180ms ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {isCustom ? 'Write my own…' : resolveArchetype(a, ctx)}
                    {active && <Check size={13} color={PALETTE.espresso} />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {state.words.opening === 'custom' && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              value={customLine1}
              onChange={(e) => {
                setCustomLine1(e.target.value);
                update({ words: { ...state.words, openingCustom: [e.target.value, customLine2] } });
              }}
              placeholder="Line one…"
              style={{
                width: '100%',
                border: `1px solid ${PALETTE.parchment}`,
                borderRadius: 2,
                outline: 'none',
                padding: '12px 16px',
                fontFamily: '"Cormorant Garamond", serif',
                fontSize: 20,
                fontStyle: 'italic',
                color: PALETTE.espresso,
                background: 'white',
                boxSizing: 'border-box',
              }}
            />
            <input
              value={customLine2}
              onChange={(e) => {
                setCustomLine2(e.target.value);
                update({ words: { ...state.words, openingCustom: [customLine1, e.target.value] } });
              }}
              placeholder="Line two (optional)…"
              style={{
                width: '100%',
                border: `1px solid ${PALETTE.parchment}`,
                borderRadius: 2,
                outline: 'none',
                padding: '12px 16px',
                fontFamily: '"Cormorant Garamond", serif',
                fontSize: 20,
                fontStyle: 'italic',
                color: PALETTE.espresso,
                background: 'white',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}
      </StageShell>
    );
  }

  // 5.5.2 — Closing
  if (sub === 1) {
    return (
      <StageShell
        eyebrow="The Words"
        title={<>And how should it <em>close</em>?</>}
        lede="The final line. It will appear over the last scene."
        onNext={advance}
        onBack={retreat}
        canNext={true}
        nextLabel="Next: Captions"
      >
        {Object.entries(closingGroups).map(([group, archetypes]) => (
          <div key={group} style={{ marginBottom: 28 }}>
            <div style={{ marginBottom: 12 }}><Eyebrow>{group}</Eyebrow></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {archetypes.map((a) => {
                const active = state.words.closing === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setClosing(a.id)}
                    style={{
                      padding: '10px 18px',
                      border: `1px solid ${active ? PALETTE.espresso : PALETTE.parchmentLight}`,
                      background: active ? PALETTE.boneSoft : 'white',
                      borderRadius: 999,
                      cursor: 'pointer',
                      fontFamily: '"Cormorant Garamond", serif',
                      fontSize: 16,
                      fontStyle: 'italic',
                      color: PALETTE.espresso,
                      transition: 'all 180ms ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {a.id === 'custom' ? 'Write my own…' : resolveArchetype(a, ctx)}
                    {active && <Check size={13} color={PALETTE.espresso} />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {state.words.closing === 'custom' && (
          <div style={{ marginTop: 16 }}>
            <input
              value={customClosing}
              onChange={(e) => {
                setCustomClosing(e.target.value);
                update({ words: { ...state.words, closingCustom: e.target.value } });
              }}
              placeholder="Your closing line…"
              style={{
                width: '100%',
                border: `1px solid ${PALETTE.parchment}`,
                borderRadius: 2,
                outline: 'none',
                padding: '12px 16px',
                fontFamily: '"Cormorant Garamond", serif',
                fontSize: 20,
                fontStyle: 'italic',
                color: PALETTE.espresso,
                background: 'white',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}
      </StageShell>
    );
  }

  // 5.5.3 — Mid-tribute captions
  if (sub === 2) {
    const voiceHint = state.format ? captionVoiceFor(state.format) : null;
    return (
      <StageShell
        eyebrow="The Words"
        title={<>A few <em>caption moments</em>?</>}
        lede={`Pick up to 3 beats to add a caption to. Suggestions below are resolved to ${petName}'s voice.`}
        onNext={advance}
        onBack={retreat}
        canNext={true}
        nextLabel="Next: Music"
      >
        {voiceHint && (
          <div style={{ background: PALETTE.boneSoft, border: `1px solid ${PALETTE.parchmentLight}`, borderRadius: 4, padding: '10px 14px', marginBottom: 20, display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <Sans style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: PALETTE.mute, flexShrink: 0 }}>Voice</Sans>
            <Sans style={{ fontSize: 13, color: PALETTE.espresso, fontStyle: 'italic' }}>{voiceHint.tenseHint}</Sans>
          </div>
        )}
        <Sans
          style={{
            fontSize: 13,
            color: PALETTE.mute,
            marginBottom: 20,
            fontStyle: 'italic',
          }}
        >
          {state.words.captions.length === 0
            ? 'No captions selected — skipping is perfectly fine.'
            : `${state.words.captions.length} of 3 selected.`}
        </Sans>
        <FieldGroup label="Choose beats to caption">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {beatIndices.map((i) => {
              const selected = state.words.captions.find((c) => c.beatIndex === i);
              const locked = !selected && state.words.captions.length >= 3;
              return (
                <button
                  key={i}
                  onClick={() => {
                    if (locked) return;
                    const suggestion = captionSuggestions[i % captionSuggestions.length]?.text ?? '';
                    toggleCaption(i, selected ? selected.text : suggestion);
                  }}
                  style={{
                    padding: '8px 14px',
                    border: `1px solid ${selected ? PALETTE.espresso : PALETTE.parchmentLight}`,
                    background: selected ? PALETTE.boneSoft : 'white',
                    borderRadius: 999,
                    cursor: locked ? 'not-allowed' : 'pointer',
                    opacity: locked ? 0.45 : 1,
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 13,
                    color: PALETTE.espresso,
                    transition: 'all 180ms ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  Beat {i + 1}
                  {selected && <Check size={11} color={PALETTE.espresso} />}
                </button>
              );
            })}
          </div>
        </FieldGroup>

        {state.words.captions.length > 0 && (
          <FieldGroup label="Edit captions">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {state.words.captions.map((cap) => (
                <div key={cap.beatIndex} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Sans
                    style={{
                      fontSize: 12,
                      color: PALETTE.mute,
                      minWidth: 52,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Beat {cap.beatIndex + 1}
                  </Sans>
                  <input
                    value={cap.text}
                    onChange={(e) => {
                      const next = state.words.captions.map((c) =>
                        c.beatIndex === cap.beatIndex ? { ...c, text: e.target.value } : c,
                      );
                      update({ words: { ...state.words, captions: next } });
                    }}
                    style={{
                      flex: 1,
                      border: `1px solid ${PALETTE.parchment}`,
                      borderRadius: 2,
                      outline: 'none',
                      padding: '10px 14px',
                      fontFamily: '"Cormorant Garamond", serif',
                      fontSize: 18,
                      fontStyle: 'italic',
                      color: PALETTE.espresso,
                      background: 'white',
                    }}
                  />
                </div>
              ))}
            </div>
          </FieldGroup>
        )}

        <FieldGroup label="Caption suggestions" hint="click to use">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {captionSuggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => {
                  const firstUnused = beatIndices.find(
                    (i) => !state.words.captions.find((c) => c.beatIndex === i),
                  );
                  if (firstUnused === undefined || state.words.captions.length >= 3) return;
                  const next = [...state.words.captions, { beatIndex: firstUnused, text: s.text }];
                  update({ words: { ...state.words, captions: next } });
                }}
                style={{
                  padding: '8px 14px',
                  border: `1px solid ${PALETTE.parchmentLight}`,
                  background: 'white',
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontFamily: '"Cormorant Garamond", serif',
                  fontSize: 15,
                  fontStyle: 'italic',
                  color: PALETTE.mute,
                  transition: 'all 180ms ease',
                }}
              >
                {s.text}
              </button>
            ))}
          </div>
        </FieldGroup>
      </StageShell>
    );
  }

  // 5.5.4 — Music
  if (sub === 3) {
    return (
      <StageShell
        eyebrow="The Words"
        title={<>What should it <em>sound</em> like?</>}
        lede="Four tracks chosen to fit your theme and style. No music works beautifully too."
        onNext={advance}
        onBack={retreat}
        canNext={true}
        nextLabel="Next: Narration"
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 10,
          }}
        >
          {musicOptions.map((m) => {
            const active = state.words.music === m.id;
            const wavePattern = m.mood.includes('ambient') || m.mood === 'ethereal'
              ? 'pads'
              : m.mood.includes('string')
              ? 'strings'
              : m.id === 'silence'
              ? 'silence'
              : 'piano';
            return (
              <button
                key={m.id}
                onClick={() => setMusic(m.id)}
                style={{
                  textAlign: 'left',
                  padding: '14px 16px',
                  border: `1px solid ${active ? PALETTE.espresso : PALETTE.parchmentLight}`,
                  background: active ? PALETTE.boneSoft : 'white',
                  cursor: 'pointer',
                  borderRadius: 4,
                  transition: 'all 180ms ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  if (!active)
                    (e.currentTarget as HTMLButtonElement).style.borderColor = PALETTE.brass;
                }}
                onMouseLeave={(e) => {
                  if (!active)
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      PALETTE.parchmentLight;
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: PALETTE.espresso,
                      color: PALETTE.bone,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <Play size={11} style={{ marginLeft: 1 }} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Serif style={{ fontSize: 16, lineHeight: 1.1 }}>{m.name}</Serif>
                    <Sans style={{ fontSize: 11, color: PALETTE.mute, marginTop: 2 }}>
                      {m.description}
                    </Sans>
                  </div>
                  {active && <Check size={13} color={PALETTE.espresso} />}
                </div>
                <Waveform pattern={wavePattern} playing={active} />
              </button>
            );
          })}
        </div>
      </StageShell>
    );
  }

  // 5.5.5 — Narration
  if (sub === 4) {
    const narrationOn = state.words.narration !== 'off';
    return (
      <StageShell
        eyebrow="The Words"
        title={<>Would you like a <em>voiceover</em>?</>}
        lede="Optional. Music alone is the gentle default — narration adds your words to the tribute."
        onNext={advance}
        onBack={retreat}
        canNext={true}
        nextLabel="Next: Review"
      >
        <FieldGroup label="Narration">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 10,
            }}
          >
            <button
              onClick={() => setNarration('off')}
              style={{
                textAlign: 'left',
                padding: '12px 14px',
                border: `1px solid ${!narrationOn ? PALETTE.espresso : PALETTE.parchmentLight}`,
                background: !narrationOn ? PALETTE.boneSoft : 'white',
                cursor: 'pointer',
                borderRadius: 4,
                transition: 'all 180ms ease',
              }}
            >
              <Serif style={{ fontSize: 16 }}>No narration</Serif>
              <Sans style={{ fontSize: 12, color: PALETTE.mute, marginTop: 4 }}>
                Music carries the tribute
              </Sans>
            </button>
            {narrationVoices
              .filter((v) => v.id !== 'user_recorded')
              .map((v) => {
                const active = state.words.narration === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setNarration(v.id)}
                    style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      border: `1px solid ${active ? PALETTE.espresso : PALETTE.parchmentLight}`,
                      background: active ? PALETTE.boneSoft : 'white',
                      cursor: 'pointer',
                      borderRadius: 4,
                      transition: 'all 180ms ease',
                    }}
                  >
                    <Serif style={{ fontSize: 16 }}>{v.name}</Serif>
                    <Sans style={{ fontSize: 12, color: PALETTE.mute, marginTop: 4 }}>
                      {v.description}
                    </Sans>
                  </button>
                );
              })}
          </div>
        </FieldGroup>

        {narrationOn && (
          <FieldGroup label="Subtitles" hint="On-screen captions of the narration, synced to the voice.">
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ id: true, label: 'On' }, { id: false, label: 'Off' }].map(({ id, label }) => {
                const active = state.words.subtitles === id;
                return (
                  <button
                    key={label}
                    onClick={() => setSubtitles(id)}
                    style={{
                      padding: '10px 18px',
                      border: `1px solid ${active ? PALETTE.espresso : PALETTE.parchmentLight}`,
                      background: active ? PALETTE.boneSoft : 'white',
                      borderRadius: 999,
                      cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 13,
                      color: PALETTE.espresso,
                      transition: 'all 180ms ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {label}
                    {active && <Check size={11} color={PALETTE.espresso} />}
                  </button>
                );
              })}
            </div>
          </FieldGroup>
        )}

        {narrationOn && (
          <FieldGroup label="A few questions for the voiceover" hint="optional — all skippable">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {NARRATION_QUESTIONS.map((q, idx) => (
                <div key={idx}>
                  <Sans
                    style={{ fontSize: 13, color: PALETTE.mute, marginBottom: 6, fontStyle: 'italic' }}
                  >
                    {q}
                  </Sans>
                  <textarea
                    value={narrationAnswers[idx] ?? ''}
                    onChange={(e) => {
                      const next = [...narrationAnswers];
                      next[idx] = e.target.value;
                      setNarrationAnswers(next);
                      update({ words: { ...state.words, narrationLetter: next } });
                    }}
                    rows={2}
                    placeholder="Optional…"
                    style={{
                      width: '100%',
                      fontFamily: '"Cormorant Garamond", serif',
                      fontSize: 17,
                      fontStyle: 'italic',
                      padding: '10px 14px',
                      border: `1px solid ${PALETTE.parchmentLight}`,
                      borderRadius: 2,
                      background: PALETTE.boneSoft,
                      color: PALETTE.espresso,
                      resize: 'vertical',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>
              ))}
            </div>
          </FieldGroup>
        )}
      </StageShell>
    );
  }

  // 5.5.6 — Review summary (GateReview-like, but technically part of TheWords — "Yes" sets reviewed)
  const openingA = openingArchetypes.find((a) => a.id === state.words.opening);
  const closingA = closingArchetypes.find((a) => a.id === state.words.closing);
  const openingLabel = openingA
    ? state.words.opening === 'custom'
      ? state.words.openingCustom[0] || 'Custom'
      : resolveArchetype(openingA, ctx)
    : '—';
  const closingLabel = closingA
    ? state.words.closing === 'custom'
      ? state.words.closingCustom || 'Custom'
      : resolveArchetype(closingA, ctx)
    : '—';
  const musicTrack = musicOptions.find((m) => m.id === state.words.music);

  return (
    <GateReview
      eyebrow="The Words"
      title={<>These are <em>{petName}&apos;s</em> words.</>}
      lede="A summary of everything you&apos;ve chosen. When it feels right, continue."
      options={[
        { id: 'yes', label: 'Yes — these feel right', tone: 'primary' },
        { id: 'opening', label: 'Change the opening' },
        { id: 'closing', label: 'Change the closing' },
        { id: 'music', label: 'Change the music' },
      ]}
      onSelect={(id) => {
        if (id === 'yes') {
          update({ words: { ...state.words, reviewed: true } });
          onNext();
        } else if (id === 'opening') setSub(0);
        else if (id === 'closing') setSub(1);
        else if (id === 'music') setSub(3);
      }}
      onBack={retreat}
    >
      <div
        style={{
          background: PALETTE.boneSoft,
          border: `1px solid ${PALETTE.parchmentLight}`,
          borderRadius: 4,
          padding: '20px 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 20,
        }}
      >
        <SummaryItem label="Opening" value={openingLabel} />
        <SummaryItem label="Closing" value={closingLabel} />
        <SummaryItem
          label="Captions"
          value={
            state.words.captions.length === 0
              ? 'None'
              : `${state.words.captions.length} beat${state.words.captions.length > 1 ? 's' : ''}`
          }
        />
        <SummaryItem label="Music" value={musicTrack?.name ?? 'Silence'} />
        <SummaryItem
          label="Narration"
          value={
            state.words.narration === 'off'
              ? 'None'
              : narrationVoices.find((v) => v.id === state.words.narration)?.name ?? 'On'
          }
        />
        {state.words.narration !== 'off' && (
          <SummaryItem label="Subtitles" value={state.words.subtitles ? 'On' : 'Off'} />
        )}
      </div>
    </GateReview>
  );
}
