"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Upload, Link as LinkIcon, X, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { PALETTE } from '../lib/palette';
import { Serif, Sans, Eyebrow, PrimaryButton, StageShell } from '../lib/primitives';
import { useBuilder } from '../state';
import type { PetPhoto } from '../state';
import type { StageProps } from './types';
import { normalizeImageUrl } from '../lib/generation';

export default function Photos({ onNext, onBack }: StageProps) {
  const { state, update } = useBuilder();
  const [url, setUrl] = useState('');
  const [drag, setDrag] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Monotonic id source — avoids Date.now() (impure during render) for keys/ids.
  const idSeq = useRef(0);

  // Always-current snapshot of petPhotos so async upload callbacks merge into
  // the latest array (avoids one upload clobbering another's url).
  const photosRef = useRef(state.petPhotos);
  useEffect(() => {
    photosRef.current = state.petPhotos;
  });

  // Merge a patch into one photo, keeping photosRef in sync so concurrent
  // uploads/imports never clobber each other's writes. Safe to call after an
  // await (photosRef is the latest committed array by then).
  function patchPhoto(id: string, patch: Partial<PetPhoto>) {
    const next = photosRef.current.map((p) => (p.id === id ? { ...p, ...patch } : p));
    photosRef.current = next;
    update({ petPhotos: next });
  }

  // Re-host an uploaded file to durable storage (S3 when configured, else fal),
  // then set the photo's `url` so it persists and survives a save + resume.
  // A failure is surfaced (status 'error') so the photo is never SILENTLY lost.
  async function uploadPhoto(file: File, id: string) {
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/photo/upload', { method: 'POST', body: fd });
      if (!res.ok) { patchPhoto(id, { status: 'error' }); return; }
      const json = (await res.json()) as { url?: string };
      if (!json.url) { patchPhoto(id, { status: 'error' }); return; }
      patchPhoto(id, { url: json.url, status: 'ready' });
    } catch {
      patchPhoto(id, { status: 'error' });
    }
  }

  // Copy a pasted link onto durable storage. On failure we keep the (normalized)
  // external URL so it still works this session + can be retried.
  async function importUrl(id: string, link: string) {
    try {
      const res = await fetch('/api/photo/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link }),
      });
      const json = (await res.json().catch(() => ({}))) as { url?: string; stored?: boolean };
      if (res.ok && json.url && json.stored) {
        patchPhoto(id, { url: json.url, status: 'ready' });
      } else {
        // Couldn't durably re-host — keep the external link, flag for retry.
        patchPhoto(id, { url: json.url ?? link, status: 'error' });
      }
    } catch {
      patchPhoto(id, { url: link, status: 'error' });
    }
  }

  function retry(id: string) {
    const p = photosRef.current.find((x) => x.id === id);
    if (!p) return;
    patchPhoto(id, { status: 'uploading' });
    if (p.file) { void uploadPhoto(p.file, id); return; }
    if (p.source) { void importUrl(id, p.source); }
  }

  const addFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const incoming = Array.from(fileList).filter(f => f && f.type && (f.type.startsWith('image/') || f.name.toLowerCase().endsWith('.heic') || f.name.toLowerCase().endsWith('.heif')));
    if (incoming.length === 0) return;
    const mapped: PetPhoto[] = incoming.map((f, idx) => ({
      id: `file-${idSeq.current++}`,
      name: f.name || `photo_${state.petPhotos.length + idx + 1}.jpg`,
      file: f,
      preview: URL.createObjectURL(f),
      status: 'uploading',
    }));
    const next = [...photosRef.current, ...mapped];
    photosRef.current = next;
    update({ petPhotos: next });
    // Upload each in the background; sets a durable `url` (or 'error') when done.
    mapped.forEach((photo, idx) => uploadPhoto(incoming[idx], photo.id));
  };

  const openPicker = () => {
    fileInputRef.current?.click();
  };

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    if (e.target) e.target.value = '';
  };

  const addUrl = () => {
    if (!url.trim()) return;
    // Normalize Google Drive / Dropbox share links to a directly-fetchable image
    // URL (used for the preview, the downstream AI fetch, and the S3 import).
    const normalized = normalizeImageUrl(url.trim());
    const id = `url-${idSeq.current++}`;
    const photo: PetPhoto = {
      id,
      name: 'Linked image',
      url: normalized,    // shows immediately; replaced by the durable url on import
      source: normalized, // kept so the import can be retried
      status: 'uploading',
    };
    const next = [...photosRef.current, photo];
    photosRef.current = next;
    update({ petPhotos: next });
    setUrl('');
    // Copy it onto our own storage so it survives resume (not just while the
    // third-party share link lives).
    void importUrl(id, normalized);
  };

  const remove = (id: string) => {
    const target = state.petPhotos.find(p => p.id === id);
    if (target?.preview) {
      try { URL.revokeObjectURL(target.preview); } catch { /* noop */ }
    }
    update({ petPhotos: state.petPhotos.filter(p => p.id !== id) });
  };

  return (
    <StageShell
      eyebrow="Their likeness"
      title={<>Add some photos of <em>your pet</em>.</>}
      lede="A face shot, side profile, full body — anything that shows their personality. More angles help us capture their likeness more accurately."
      onNext={onNext}
      onBack={onBack}
      canNext={state.petPhotos.length > 0 && state.petPhotos.every((p) => !!p.url)}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        onChange={onFilePicked}
        style={{ display: 'none' }}
      />

      <div
        role="button"
        tabIndex={0}
        aria-label="Add photos"
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer?.files ?? null); }}
        onClick={openPicker}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); } }}
        style={{
          border: `1.5px dashed ${drag ? PALETTE.brass : PALETTE.parchment}`,
          background: drag ? 'rgba(201,169,97,0.06)' : PALETTE.boneSoft,
          padding: '48px 24px',
          textAlign: 'center',
          borderRadius: 4,
          transition: 'all 180ms ease',
          cursor: 'pointer',
        }}
      >
        <Upload size={28} color={PALETTE.brass} style={{ marginBottom: 12 }} />
        <Serif style={{ fontSize: 22, color: PALETTE.espresso }}>Drag photos here</Serif>
        <Sans style={{ color: PALETTE.mute, fontSize: 13, marginTop: 6 }}>or click to browse — JPG, PNG, HEIC</Sans>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '24px 0' }}>
        <div style={{ flex: 1, height: 1, background: PALETTE.parchmentLight }} />
        <Sans style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: PALETTE.mute }}>or paste a link</Sans>
        <div style={{ flex: 1, height: 1, background: PALETTE.parchmentLight }} />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${PALETTE.parchment}`, borderRadius: 2, padding: '12px 14px', background: 'white' }}>
          <LinkIcon size={16} color={PALETTE.mute} />
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addUrl(); }}
            placeholder="Google Drive, Dropbox, or direct link"
            style={{ border: 'none', outline: 'none', flex: 1, fontFamily: 'Inter, sans-serif', fontSize: 14, background: 'transparent', color: PALETTE.espresso }}
          />
        </div>
        <PrimaryButton onClick={addUrl} secondary>Add</PrimaryButton>
      </div>

      <Sans style={{ fontSize: 12, color: PALETTE.mute, marginTop: 8, fontStyle: 'italic' }}>
        Google Drive &amp; Dropbox links must be shared so anyone with the link can view.
      </Sans>

      {state.petPhotos.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <Eyebrow>{state.petPhotos.length} {state.petPhotos.length === 1 ? 'photo' : 'photos'} added</Eyebrow>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12, marginTop: 12 }}>
            {state.petPhotos.map(p => (
              <div key={p.id} style={{ position: 'relative', aspectRatio: '1', background: `linear-gradient(135deg, ${PALETTE.parchment}, ${PALETTE.parchmentLight})`, borderRadius: 2, overflow: 'hidden', border: p.status === 'error' ? '2px solid #b3402f' : '2px solid transparent' }}>
                {(p.preview || p.url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.preview ?? p.url} alt={p.name || 'pet photo'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: p.status === 'uploading' || p.status === 'error' ? 0.5 : 1 }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sans style={{ fontSize: 11, color: PALETTE.mute }}>{p.name}</Sans>
                  </div>
                )}

                {p.status === 'uploading' && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(245,242,235,0.35)' }}>
                    <Loader2 size={20} color={PALETTE.espresso} style={{ animation: 'spin 1s linear infinite' }} />
                    <Sans style={{ fontSize: 10, color: PALETTE.espresso, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Saving…</Sans>
                  </div>
                )}
                {p.status === 'error' && (
                  <button
                    onClick={() => retry(p.id)}
                    title="Couldn't save this photo — click to retry"
                    style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(179,64,47,0.18)', border: 'none', cursor: 'pointer', color: '#b3402f' }}
                  >
                    <AlertTriangle size={20} color="#b3402f" />
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontFamily: 'Inter, sans-serif', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      <RefreshCw size={11} /> Retry
                    </span>
                  </button>
                )}

                <button
                  onClick={() => remove(p.id)}
                  style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(42,33,27,0.8)', color: PALETTE.bone, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          {state.petPhotos.some((p) => !p.url || p.status === 'uploading' || p.status === 'error') && (
            <Sans style={{ fontSize: 12, color: '#b3402f', marginTop: 12, fontStyle: 'italic' }}>
              Some photos are still saving or didn&apos;t upload — wait a moment, or retry/remove them before continuing.
            </Sans>
          )}
          {state.petPhotos.length === 1 && (
            <Serif italic style={{ marginTop: 18, color: PALETTE.mute, fontSize: 16 }}>
              If you have any more from a different angle, they&apos;ll help us capture them more accurately. If this is the only one, that&apos;s completely OK.
            </Serif>
          )}
        </div>
      )}
    </StageShell>
  );
}
