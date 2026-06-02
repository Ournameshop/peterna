"use client";

// A picker that lists saved tribute drafts (from GET /api/build) with their
// progress, so the user can jump back into any one. Opening a build navigates
// to /builder?id=<id>, which the entry page loads + resumes at its saved step.

import React, { useEffect, useState } from 'react';
import { X, Loader2, ArrowRight } from 'lucide-react';
import { PALETTE } from '../lib/palette';
import { Serif, Sans, Eyebrow } from '../lib/primitives';
import { STEPS, STEP_GROUPS } from '../steps';

interface BuildSummary {
  id: string;
  petName: string | null;
  stepIndex: number;
  updatedAt: string;
}

function progressFor(stepIndex: number): { label: string; pct: number } {
  const step = STEPS[stepIndex];
  const group = step ? STEP_GROUPS.find((g) => g.id === step.group) : null;
  const last = STEPS.length - 1;
  const pct = Math.max(0, Math.min(100, Math.round((stepIndex / last) * 100)));
  return { label: group?.label ?? 'In progress', pct };
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function BuildsModal({ onClose }: { onClose: () => void }) {
  const [builds, setBuilds] = useState<BuildSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/build', { cache: 'no-store' });
        if (!res.ok) throw new Error('Could not load your tributes.');
        const json = (await res.json()) as { builds: BuildSummary[] };
        if (!cancelled) setBuilds(json.builds ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Close on Escape.
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  function open(id: string) {
    // Full navigation (not router.push) so the entry page re-runs its load
    // effect and hydrates this build's saved state.
    window.location.assign(`/builder?id=${encodeURIComponent(id)}`);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(42,33,27,0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: PALETTE.bone,
          border: `1px solid ${PALETTE.parchmentLight}`,
          borderRadius: 6,
          width: '100%',
          maxWidth: 560,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: `1px solid ${PALETTE.parchmentLight}`,
          }}
        >
          <div>
            <Eyebrow>Continue a tribute</Eyebrow>
            <Serif italic style={{ fontSize: 22, color: PALETTE.espresso, marginTop: 4 }}>
              Your saved tributes
            </Serif>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: PALETTE.mute,
              display: 'flex',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '8px 0' }}>
          {builds === null && !error && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 }}>
              <Loader2 size={18} color={PALETTE.brass} style={{ animation: 'bm-spin 1.1s linear infinite' }} />
              <Sans style={{ fontSize: 14, color: PALETTE.mute }}>Loading…</Sans>
            </div>
          )}

          {error && (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <Sans style={{ fontSize: 14, color: '#B91C1C' }}>{error}</Sans>
            </div>
          )}

          {builds && builds.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Serif italic style={{ fontSize: 18, color: PALETTE.mute }}>
                No saved tributes yet.
              </Serif>
            </div>
          )}

          {builds &&
            builds.map((b) => {
              const { label, pct } = progressFor(b.stepIndex);
              const done = b.stepIndex >= STEPS.length - 1;
              return (
                <button
                  key={b.id}
                  onClick={() => open(b.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: `1px solid ${PALETTE.parchmentLight}`,
                    padding: '16px 24px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    transition: 'background 150ms ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = PALETTE.boneSoft)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Serif italic style={{ fontSize: 18, color: PALETTE.espresso }}>
                      {b.petName?.trim() || 'Untitled tribute'}
                    </Serif>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <div
                        style={{
                          flex: 1,
                          maxWidth: 180,
                          height: 3,
                          background: PALETTE.parchmentLight,
                          borderRadius: 2,
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ height: '100%', width: `${pct}%`, background: PALETTE.brass }} />
                      </div>
                      <Sans style={{ fontSize: 11, color: PALETTE.mute, letterSpacing: '0.04em' }}>
                        {done ? 'Ready' : `${label} · ${pct}%`}
                      </Sans>
                    </div>
                    <Sans style={{ fontSize: 11, color: PALETTE.mute, marginTop: 4 }}>
                      {formatDate(b.updatedAt)}
                    </Sans>
                  </div>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 12,
                      color: PALETTE.espresso,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Continue <ArrowRight size={13} />
                  </span>
                </button>
              );
            })}
        </div>
      </div>
      <style>{`@keyframes bm-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
