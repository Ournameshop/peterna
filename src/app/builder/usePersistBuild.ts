"use client";

// usePersistBuild — fire-and-forget persistence of the builder draft.
//
// Additive only: it READS context (state + stepIndex) and writes to /api/build.
// It never throws into render, never blocks the UI, and changes no flow.
//
// LAZY creation: the Build row is NOT created on mount — that would spawn an
// empty "Untitled" draft every time someone merely opens /builder. Instead the
// row is created on the FIRST real save (first step change or state edit); the
// new id is pushed into the URL via replaceState. After that, saves are PUTs.
//
// Triggers: every step change (primary), a debounced save on state changes
// (captures asset-generation writes mid-step), and a best-effort save on unload.

import { useEffect, useRef } from 'react';
import { useBuilder } from './state';
import type { BuilderState } from './state';
import { useWizard } from './shell/Wizard';

const DEBOUNCE_MS = 1500;

// Strip non-serializable / session-only fields before persisting. `file` is a
// File object and `preview` is a blob: object URL — both are meaningless after a
// reload. The durable `url` is what downstream generation actually uses.
function serializeState(state: BuilderState): Record<string, unknown> {
  return {
    ...state,
    petPhotos: (state.petPhotos ?? []).map((p) => ({ id: p.id, name: p.name, url: p.url })),
    referenceSheetSources: (state.referenceSheetSources ?? []).map((p) => ({ id: p.id, name: p.name, url: p.url })),
  };
}

export function usePersistBuild(initialBuildId: string | null): void {
  const { state } = useBuilder();
  const { stepIndex } = useWizard();

  // Latest values for the debounced timer / unload handler to read.
  const stateRef = useRef(state);
  const stepRef = useRef(stepIndex);
  useEffect(() => {
    stateRef.current = state;
    stepRef.current = stepIndex;
  });

  // Owns the build id: starts from a resumed ?id= (or null) and is filled in
  // lazily on first save. A guard prevents creating more than one row.
  const idRef = useRef<string | null>(initialBuildId);
  useEffect(() => {
    if (initialBuildId) idRef.current = initialBuildId;
  }, [initialBuildId]);
  const creatingRef = useRef(false);

  // Stable save fn (only reads refs) — assigned once on mount.
  const save = useRef<() => void>(() => {});
  useEffect(() => {
    save.current = () => {
      const body = JSON.stringify({
        state: serializeState(stateRef.current),
        stepIndex: stepRef.current,
      });
      if (idRef.current) {
        void fetch(`/api/build/${idRef.current}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {
          /* fire-and-forget */
        });
        return;
      }
      // No row yet — create it now (once). Pushes the id into the URL so the
      // draft is shareable/resumable without a remount.
      if (creatingRef.current) return;
      creatingRef.current = true;
      void (async () => {
        try {
          const res = await fetch('/api/build', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          });
          if (res.ok) {
            const json = (await res.json()) as { id?: string };
            if (json.id) {
              idRef.current = json.id;
              window.history.replaceState(null, '', `?id=${json.id}`);
            }
          }
        } catch {
          /* persistence unavailable — wizard keeps working */
        } finally {
          creatingRef.current = false;
        }
      })();
    };
  }, []);

  // Save on step change (primary trigger). Skip the mount run.
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    save.current();
  }, [stepIndex]);

  // Debounced save on any state change (asset generation, edits within a step).
  const firstState = useRef(true);
  useEffect(() => {
    if (firstState.current) {
      firstState.current = false;
      return;
    }
    const t = setTimeout(() => save.current(), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [state]);

  // Best-effort flush when the tab closes / navigates away.
  useEffect(() => {
    const handler = () => save.current();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);
}
