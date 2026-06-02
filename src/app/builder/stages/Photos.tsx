"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Upload, Link as LinkIcon, X } from 'lucide-react';
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

  // Always-current snapshot of petPhotos so async upload callbacks merge into
  // the latest array (avoids one upload clobbering another's url).
  const photosRef = useRef(state.petPhotos);
  useEffect(() => {
    photosRef.current = state.petPhotos;
  });

  // Re-host an uploaded file to durable storage (S3 when configured, else fal),
  // then set the photo's `url` so it persists and survives a save + resume.
  async function uploadPhoto(file: File, id: string) {
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/photo/upload', { method: 'POST', body: fd });
      if (!res.ok) return; // keep preview-only; works this session, lost on resume
      const json = (await res.json()) as { url?: string };
      if (!json.url) return;
      const next = photosRef.current.map((p) => (p.id === id ? { ...p, url: json.url } : p));
      photosRef.current = next; // sync immediately so concurrent uploads don't clobber
      update({ petPhotos: next });
    } catch {
      // Network failure — photo still shows via its blob preview this session.
    }
  }

  const addFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const incoming = Array.from(fileList).filter(f => f && f.type && (f.type.startsWith('image/') || f.name.toLowerCase().endsWith('.heic') || f.name.toLowerCase().endsWith('.heif')));
    if (incoming.length === 0) return;
    const mapped: PetPhoto[] = incoming.map((f, idx) => ({
      id: `file-${Date.now()}-${idx}`,
      name: f.name || `photo_${state.petPhotos.length + idx + 1}.jpg`,
      file: f,
      preview: URL.createObjectURL(f),
    }));
    update({ petPhotos: [...state.petPhotos, ...mapped] });
    // Upload each in the background; sets a durable `url` when done.
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
    // Normalize Google Drive / Dropbox share links to a directly-fetchable
    // image URL so the preview and the downstream AI fetches both work.
    const photo: PetPhoto = {
      id: `url-${Date.now()}`,
      name: 'Linked image',
      url: normalizeImageUrl(url.trim()),
    };
    update({ petPhotos: [...state.petPhotos, photo] });
    setUrl('');
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
      canNext={state.petPhotos.length > 0}
    >
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
              <div key={p.id} style={{ position: 'relative', aspectRatio: '1', background: `linear-gradient(135deg, ${PALETTE.parchment}, ${PALETTE.parchmentLight})`, borderRadius: 2, overflow: 'hidden' }}>
                {(p.preview || p.url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.preview ?? p.url} alt={p.name || 'pet photo'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sans style={{ fontSize: 11, color: PALETTE.mute }}>{p.name}</Sans>
                  </div>
                )}
                <button
                  onClick={() => remove(p.id)}
                  style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(42,33,27,0.8)', color: PALETTE.bone, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
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
