"use client";

import React, { useEffect, useState } from 'react';
import { PALETTE } from '../lib/palette';
import { Serif, Sans, StageShell, ApprovalPills } from '../lib/primitives';
import { useBuilder } from '../state';
import { generateBeatSheet } from '@/lib/peternal-beatsheet';
import type { StageProps } from './types';
import type { Beat } from '../state';

export default function BeatSheet({ onNext, onBack }: StageProps) {
  const { state, update, resetDownstream } = useBuilder();
  const [action, setAction] = useState<string | null>(null);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editField, setEditField] = useState<'name' | 'visual' | 'caption' | 'spokenOrTitle' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [reorderFrom, setReorderFrom] = useState<number | null>(null);

  useEffect(() => {
    if (state.beatSheet.length === 0 && state.format && state.theme && state.gender) {
      const beatSheet = generateBeatSheet({
        beatCount: state.beatCount,
        format: state.format,
        theme: state.theme,
        gender: state.gender,
        petName: state.petName,
        favorites: state.favorites,
        memoryPromptAnswer: state.memoryPromptAnswer,
        traits: state.traits,
      });
      update({ beatSheet });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beats = state.beatSheet;

  function handleApproval(id: string) {
    setAction(id);
    if (id === 'approve') {
      update({ beatSheetApproved: true });
      onNext();
    }
  }

  function startEdit(i: number, field: typeof editField) {
    setEditIndex(i);
    setEditField(field);
    setEditValue(beats[i][field as keyof Beat] as string);
  }

  function commitEdit() {
    if (editIndex === null || !editField) return;
    const updated = beats.map((b, i) =>
      i === editIndex ? { ...b, [editField]: editValue } : b
    );
    update({ beatSheet: updated, beatSheetApproved: false });
    resetDownstream('beatsheet');
    setEditIndex(null);
    setEditField(null);
    setAction(null);
  }

  function moveBeat(from: number, to: number) {
    if (to < 0 || to >= beats.length) return;
    const arr = [...beats];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    const reindexed = arr.map((b, i) => ({ ...b, index: i }));
    update({ beatSheet: reindexed, beatSheetApproved: false });
    resetDownstream('beatsheet');
    setReorderFrom(null);
    setAction(null);
  }

  function dropBeat(i: number) {
    const updated = beats.filter((_, idx) => idx !== i).map((b, idx) => ({ ...b, index: idx }));
    update({ beatSheet: updated, beatSheetApproved: false });
    resetDownstream('beatsheet');
    setAction(null);
  }

  function addBeat() {
    const newBeat: Beat = {
      index: beats.length,
      archetype: 'memory',
      name: 'Added beat',
      visual: 'A quiet, beloved moment',
      caption: 'A moment that was only theirs',
      spokenOrTitle: '',
      lengthSeconds: 15,
    };
    update({ beatSheet: [...beats, newBeat], beatSheetApproved: false });
    resetDownstream('beatsheet');
    setAction(null);
  }

  const approvalOptions = [
    { id: 'approve', label: 'Looks good — continue', tone: 'primary' as const },
    { id: 'change', label: 'Change a beat' },
    { id: 'reorder', label: 'Re-order' },
    { id: 'drop', label: 'Drop a beat' },
    { id: 'add', label: 'Add a beat' },
  ];

  const petName = state.petName || 'your pet';

  return (
    <StageShell
      eyebrow="The Story"
      title={`${petName}'s story, beat by beat`}
      lede={`Here's the ${beats.length}-beat arc. Each beat is a 15-second scene in the tribute.`}
      onBack={onBack}
      hideNext
    >
      {beats.length === 0 && (
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <Sans style={{ color: PALETTE.mute, fontSize: 14 }}>Composing the story…</Sans>
        </div>
      )}

      {beats.length > 0 && (
        <div style={{ overflowX: 'auto', marginBottom: 32 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${PALETTE.parchmentLight}` }}>
                {['#', 'Beat', 'Visual', 'Caption', 'Spoken / Title'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontFamily: 'Inter, sans-serif', fontWeight: 500, color: PALETTE.mute, letterSpacing: '0.08em', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                ))}
                {(action === 'change' || action === 'drop' || action === 'reorder') && (
                  <th style={{ padding: '8px 12px', color: PALETTE.mute, fontFamily: 'Inter, sans-serif', fontSize: 11, textTransform: 'uppercase' }}>Action</th>
                )}
              </tr>
            </thead>
            <tbody>
              {beats.map((beat, i) => {
                const isEditing = editIndex === i && action === 'change';
                const rowBg = i % 2 === 0 ? PALETTE.boneSoft : 'white';
                return (
                  <tr key={beat.index} style={{ background: rowBg, borderBottom: `1px solid ${PALETTE.parchmentLight}` }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'Inter, sans-serif', color: PALETTE.mute, fontSize: 12, minWidth: 28 }}>{i + 1}</td>
                    <td style={{ padding: '10px 12px', minWidth: 100 }}>
                      {isEditing && editField === 'name' ? (
                        <input value={editValue} onChange={e => setEditValue(e.target.value)}
                          style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: 15, border: `1px solid ${PALETTE.brass}`, borderRadius: 2, padding: '4px 8px', width: '100%', background: 'white' }}/>
                      ) : (
                        <Serif style={{ fontSize: 15, color: PALETTE.espresso }}>{beat.name}</Serif>
                      )}
                      <Sans style={{ fontSize: 10, color: PALETTE.mute, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>{beat.archetype}</Sans>
                    </td>
                    <td style={{ padding: '10px 12px', maxWidth: 220 }}>
                      {isEditing && editField === 'visual' ? (
                        <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={3}
                          style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, border: `1px solid ${PALETTE.brass}`, borderRadius: 2, padding: '4px 8px', width: '100%', resize: 'vertical' }}/>
                      ) : (
                        <Sans style={{ fontSize: 13, color: PALETTE.espresso, lineHeight: 1.4 }}>{beat.visual}</Sans>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', maxWidth: 180 }}>
                      {isEditing && editField === 'caption' ? (
                        <input value={editValue} onChange={e => setEditValue(e.target.value)}
                          style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, border: `1px solid ${PALETTE.brass}`, borderRadius: 2, padding: '4px 8px', width: '100%' }}/>
                      ) : (
                        <Serif italic style={{ fontSize: 13, color: PALETTE.espresso }}>{beat.caption}</Serif>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', maxWidth: 180 }}>
                      {isEditing && editField === 'spokenOrTitle' ? (
                        <input value={editValue} onChange={e => setEditValue(e.target.value)}
                          style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, border: `1px solid ${PALETTE.brass}`, borderRadius: 2, padding: '4px 8px', width: '100%' }}/>
                      ) : (
                        <Serif italic style={{ fontSize: 13, color: PALETTE.mute }}>{beat.spokenOrTitle || '—'}</Serif>
                      )}
                    </td>
                    {action === 'change' && (
                      <td style={{ padding: '10px 12px', minWidth: 180 }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {(['name', 'visual', 'caption', 'spokenOrTitle'] as const).map(f => (
                              <button key={f} onClick={() => { setEditField(f); setEditValue(beats[i][f] as string); }}
                                style={{ fontSize: 11, padding: '3px 8px', border: `1px solid ${editField === f ? PALETTE.espresso : PALETTE.parchment}`, borderRadius: 999, background: editField === f ? PALETTE.espresso : 'transparent', color: editField === f ? PALETTE.bone : PALETTE.espresso, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                                {f === 'spokenOrTitle' ? 'spoken' : f}
                              </button>
                            ))}
                            <button onClick={commitEdit}
                              style={{ fontSize: 11, padding: '3px 10px', border: 'none', borderRadius: 999, background: PALETTE.brass, color: 'white', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                              Save
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(i, 'visual')}
                            style={{ fontSize: 11, padding: '4px 10px', border: `1px solid ${PALETTE.parchment}`, borderRadius: 999, background: 'transparent', color: PALETTE.espresso, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                            Edit this beat
                          </button>
                        )}
                      </td>
                    )}
                    {action === 'drop' && (
                      <td style={{ padding: '10px 12px' }}>
                        <button onClick={() => dropBeat(i)}
                          style={{ fontSize: 11, padding: '4px 10px', border: `1px solid ${PALETTE.parchment}`, borderRadius: 999, background: 'transparent', color: PALETTE.mute, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                          Remove
                        </button>
                      </td>
                    )}
                    {action === 'reorder' && (
                      <td style={{ padding: '10px 12px' }}>
                        {reorderFrom === null ? (
                          <button onClick={() => setReorderFrom(i)}
                            style={{ fontSize: 11, padding: '4px 10px', border: `1px solid ${PALETTE.parchment}`, borderRadius: 999, background: 'transparent', color: PALETTE.espresso, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                            Move from here
                          </button>
                        ) : reorderFrom === i ? (
                          <Sans style={{ fontSize: 11, color: PALETTE.brass }}>Selected</Sans>
                        ) : (
                          <button onClick={() => moveBeat(reorderFrom, i)}
                            style={{ fontSize: 11, padding: '4px 10px', border: `1px solid ${PALETTE.brass}`, borderRadius: 999, background: PALETTE.brass, color: 'white', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                            Move to here
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {action === 'add' && (
        <div style={{ marginBottom: 16 }}>
          <button onClick={addBeat}
            style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, padding: '10px 20px', border: `1px solid ${PALETTE.parchment}`, borderRadius: 999, background: 'transparent', color: PALETTE.espresso, cursor: 'pointer' }}>
            + Add a memory beat at the end
          </button>
        </div>
      )}

      <div style={{ borderTop: `1px solid ${PALETTE.parchmentLight}`, paddingTop: 28, marginTop: 8 }}>
        <ApprovalPills options={approvalOptions} onSelect={handleApproval} selected={action === 'approve' ? 'approve' : null} />
      </div>
    </StageShell>
  );
}
