"use client";

// usePersistBuild — fire-and-forget persistence of the builder draft.
//
// Additive only: it READS context (state + stepIndex) and PUTs to /api/build/[id].
// It never throws into render, never blocks the UI, and changes no flow. When
// buildId is null (persistence unavailable / not yet created) it is a no-op.
//
// Triggers: every step change (primary), plus a debounced save on state changes
// (captures asset-generation writes mid-step), plus a best-effort save on unload.

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
  };
}

export function usePersistBuild(buildId: string | null): void {
  const { state } = useBuilder();
  const { stepIndex } = useWizard();

  // Latest values for the debounced timer / unload handler to read.
  const stateRef = useRef(state);
  const stepRef = useRef(stepIndex);
  useEffect(() => {
    stateRef.current = state;
    stepRef.current = stepIndex;
  });

  // A stable save fn that always sees the current buildId.
  const save = useRef<() => void>(() => {});
  useEffect(() => {
    save.current = () => {
      if (!buildId) return;
      const body = JSON.stringify({
        state: serializeState(stateRef.current),
        stepIndex: stepRef.current,
      });
      void fetch(`/api/build/${buildId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {
        /* fire-and-forget — a failed save must never affect the wizard */
      });
    };
  }, [buildId]);

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
