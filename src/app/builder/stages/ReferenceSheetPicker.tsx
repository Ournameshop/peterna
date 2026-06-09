"use client";

import React, { useRef, useState } from 'react';
import { Upload, X, Loader2, Check, AlertTriangle } from 'lucide-react';
import { PALETTE } from '../lib/palette';
import { Sans, Serif, Eyebrow } from '../lib/primitives';
import { useBuilder } from '../state';
import type { PetPhoto } from '../state';
import { buildUserReferenceSheet } from '../lib/generation';

// Shown only when NEXT_PUBLIC_OWN_REFERENCE_SHEET === '1'.
// Renders inside CharacterSheet, after the AI sheet preview.
export default function ReferenceSheetPicker() {
  const { state, update } = useBuilder();
  const [enabled, setEnabled] = useState(state.useOwnReferenceSheet);
  const [selected, setSelected] = useState<string[]>(() => {
    // Filter persisted IDs to only those present in currently-available petPhotos.
    // Uploaded "ref-extra-*" photos live only in component state (empty on mount), so
    // persisted IDs referencing them would become ghosts without this filter.
    const available = new Set(state.petPhotos.filter((p) => p.url && p.status !== 'error').map((p) => p.id));
    return state.referenceSheetSources.map((p) => p.id).filter((id) => available.has(id));
  });
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idSeq = useRef(0);

  // Photos available to pick from: the already-uploaded petPhotos (with durable url).
  const availablePhotos = state.petPhotos.filter((p) => p.url && p.status !== 'error');

  // Extra photos uploaded directly in this picker (not added to petPhotos).
  const [extraPhotos, setExtraPhotos] = useState<PetPhoto[]>([]);
  const extrasRef = useRef<PetPhoto[]>([]);

  function patchExtra(id: string, patch: Partial<PetPhoto>) {
    const next = extrasRef.current.map((p) => (p.id === id ? { ...p, ...patch } : p));
    extrasRef.current = next;
    setExtraPhotos([...next]);
  }

  async function uploadExtra(file: File, id: string) {
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/photo/upload', { method: 'POST', body: fd });
      if (!res.ok) { patchExtra(id, { status: 'error' }); return; }
      const json = (await res.json()) as { url?: string };
      if (!json.url) { patchExtra(id, { status: 'error' }); return; }
      patchExtra(id, { url: json.url, status: 'ready' });
      // Auto-select newly uploaded extras.
      setSelected((prev) => prev.includes(id) ? prev : [...prev, id]);
    } catch {
      patchExtra(id, { status: 'error' });
    }
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const incoming = Array.from(fileList).filter(
      (f) => f && (f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name)),
    );
    if (incoming.length === 0) return;
    const mapped: PetPhoto[] = incoming.map((f) => ({
      id: `ref-extra-${idSeq.current++}`,
      name: f.name || 'photo.jpg',
      file: f,
      preview: URL.createObjectURL(f),
      status: 'uploading' as const,
    }));
    extrasRef.current = [...extrasRef.current, ...mapped];
    setExtraPhotos([...extrasRef.current]);
    mapped.forEach((photo, idx) => uploadExtra(incoming[idx], photo.id));
  }

  function toggleSelect(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 4
        ? [...prev, id]
        : prev,
    );
  }

  function removeExtra(id: string) {
    const p = extrasRef.current.find((x) => x.id === id);
    if (p?.preview) { try { URL.revokeObjectURL(p.preview); } catch { /* noop */ } }
    extrasRef.current = extrasRef.current.filter((x) => x.id !== id);
    setExtraPhotos([...extrasRef.current]);
    setSelected((prev) => prev.filter((x) => x !== id));
  }

  function clearSheet() {
    update({ useOwnReferenceSheet: false, userSheetUrl: null, referenceSheetSources: [] });
    setEnabled(false);
    setSelected([]);
    setError(null);
  }

  async function handleBuild() {
    setError(null);
    const allPhotos = [...availablePhotos, ...extraPhotos];
    const sources = allPhotos.filter((p) => selected.includes(p.id) && p.url);
    if (sources.length === 0) { setError('Select at least one photo.'); return; }
    setBuilding(true);
    const url = await buildUserReferenceSheet(sources);
    setBuilding(false);
    if (!url) {
      setError('Could not build the reference sheet — please try again or use fewer photos.');
      update({ useOwnReferenceSheet: false, userSheetUrl: null });
      return;
    }
    update({
      userSheetUrl: url,
      useOwnReferenceSheet: true,
      referenceSheetSources: sources,
    });
  }

  const allPhotos = [...availablePhotos, ...extraPhotos];
  const anyUploading = allPhotos.some((p) => selected.includes(p.id) && p.status === 'uploading');

  return (
    <div style={{ marginTop: 32, padding: '20px 22px', background: PALETTE.boneSoft, border: `1px solid ${PALETTE.parchmentLight}`, borderRadius: 4 }}>
      {/* Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          onClick={() => {
            if (enabled) { clearSheet(); } else { setEnabled(true); }
          }}
          style={{
            width: 40, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer',
            background: enabled ? PALETTE.espresso : PALETTE.parchment,
            position: 'relative', flexShrink: 0, transition: 'background 200ms ease',
          }}
          aria-checked={enabled}
          role="switch"
        >
          <span style={{
            position: 'absolute', top: 3, left: enabled ? 20 : 3, width: 16, height: 16,
            borderRadius: '50%', background: 'white', transition: 'left 180ms ease',
          }} />
        </button>
        <Serif style={{ fontSize: 15, color: PALETTE.espresso }}>
          Build the reference from my own photos
        </Serif>
      </div>

      {enabled && (
        <div style={{ marginTop: 18 }}>
          <Sans style={{ fontSize: 13, color: PALETTE.mute, marginBottom: 14 }}>
            Pick 1–4 photos. Backgrounds will be removed automatically before compositing.
          </Sans>

          {/* Photo grid — existing petPhotos + newly uploaded extras */}
          {allPhotos.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8, marginBottom: 14 }}>
              {allPhotos.map((p) => {
                const isSelected = selected.includes(p.id);
                const isExtra = extraPhotos.some((e) => e.id === p.id);
                return (
                  <div key={p.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 3, overflow: 'hidden',
                    border: isSelected ? `2px solid ${PALETTE.brass}` : `2px solid transparent`,
                    boxShadow: isSelected ? '0 0 0 3px rgba(201,169,97,0.20)' : 'none',
                    cursor: 'pointer',
                    background: PALETTE.parchmentLight,
                  }}
                    onClick={() => { if (p.status !== 'uploading') toggleSelect(p.id); }}
                  >
                    {(p.preview || p.url) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.preview ?? p.url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: p.status === 'uploading' ? 0.5 : 1 }} />
                    )}
                    {p.status === 'uploading' && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(245,242,235,0.4)' }}>
                        <Loader2 size={16} color={PALETTE.espresso} style={{ animation: 'spin 1s linear infinite' }} />
                      </div>
                    )}
                    {p.status === 'error' && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(179,64,47,0.18)' }}>
                        <AlertTriangle size={16} color="#b3402f" />
                      </div>
                    )}
                    {isSelected && p.status !== 'uploading' && (
                      <div style={{ position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%', background: PALETTE.brass, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={11} color="#fff" strokeWidth={3} />
                      </div>
                    )}
                    {isExtra && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); removeExtra(p.id); }}
                        style={{ position: 'absolute', top: 4, left: 4, width: 18, height: 18, borderRadius: '50%', background: 'rgba(42,33,27,0.75)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={10} color={PALETTE.bone} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Upload more */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            onChange={(e) => { addFiles(e.target.files); if (e.target) e.target.value = ''; }}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              border: `1px dashed ${PALETTE.parchment}`, borderRadius: 3, padding: '8px 14px',
              background: 'transparent', cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', fontSize: 13, color: PALETTE.espressoSoft,
              marginBottom: 16,
            }}
          >
            <Upload size={14} color={PALETTE.brass} /> Add more photos
          </button>

          {/* Build button */}
          {!state.userSheetUrl && (
            <div>
              <button
                type="button"
                disabled={selected.length === 0 || building || anyUploading}
                onClick={handleBuild}
                style={{
                  fontFamily: 'Inter, sans-serif', fontSize: 13,
                  padding: '10px 20px', border: 'none', borderRadius: 2, cursor: selected.length === 0 || building || anyUploading ? 'not-allowed' : 'pointer',
                  background: selected.length === 0 || building || anyUploading ? PALETTE.parchmentLight : PALETTE.espresso,
                  color: selected.length === 0 || building || anyUploading ? PALETTE.mute : PALETTE.bone,
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  transition: 'all 200ms ease',
                }}
              >
                {building && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                {building ? 'Building…' : anyUploading ? 'Uploading…' : 'Build my reference'}
              </button>
              {selected.length > 0 && !building && (
                <Sans style={{ fontSize: 12, color: PALETTE.mute, marginTop: 8 }}>
                  {selected.length} photo{selected.length !== 1 ? 's' : ''} selected
                </Sans>
              )}
            </div>
          )}

          {/* Preview of built sheet */}
          {state.userSheetUrl && (
            <div style={{ marginTop: 12 }}>
              <Eyebrow>Your reference sheet</Eyebrow>
              <div style={{ marginTop: 10, position: 'relative', display: 'inline-block' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={state.userSheetUrl} alt="Your reference sheet" style={{ width: 200, height: 200, objectFit: 'cover', borderRadius: 3, display: 'block' }} />
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    update({ userSheetUrl: null, useOwnReferenceSheet: false, referenceSheetSources: [] });
                    setSelected([]);
                  }}
                  style={{
                    fontFamily: 'Inter, sans-serif', fontSize: 12, padding: '7px 14px',
                    border: `1px solid ${PALETTE.parchment}`, borderRadius: 2, background: 'transparent',
                    color: PALETTE.espressoSoft, cursor: 'pointer',
                  }}
                >
                  Redo
                </button>
              </div>
            </div>
          )}

          {error && (
            <Sans style={{ fontSize: 13, color: '#b3402f', marginTop: 12 }}>{error}</Sans>
          )}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
