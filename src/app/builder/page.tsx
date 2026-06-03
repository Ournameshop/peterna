"use client";

import React, { useEffect, useRef, useState } from 'react';
import { PALETTE } from './lib/palette';
import { BuilderProvider } from './state';
import type { BuilderState } from './state';
import { WizardProvider } from './shell/Wizard';
import TopBar from './shell/TopBar';
import Wizard from './shell/Wizard';
import { usePersistBuild } from './usePersistBuild';

interface Resume {
  seed?: BuilderState;
  stepIndex: number;
}

export default function BuilderPage() {
  // resume === null means "still resolving" — render a neutral gate. The first
  // render is deterministic (always the gate) so SSR and client hydration match;
  // all URL/window logic happens in the effect below.
  const [resume, setResume] = useState<Resume | null>(null);
  const [buildId, setBuildId] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;

    const id = new URLSearchParams(window.location.search).get('id');

    (async () => {
      if (id) {
        try {
          const res = await fetch(`/api/build/${id}`, { cache: 'no-store' });
          if (res.ok) {
            const data = (await res.json()) as { id: string; state: unknown; stepIndex: number };
            if (!cancelled) {
              // Only treat a plain object as a usable seed; anything else
              // (null / corrupt) falls back to a fresh initialState in the
              // provider, which also merges in any newer schema fields.
              const seed =
                data.state && typeof data.state === 'object' && !Array.isArray(data.state)
                  ? (data.state as BuilderState)
                  : undefined;
              setBuildId(data.id);
              setResume({ seed, stepIndex: typeof data.stepIndex === 'number' ? data.stepIndex : 0 });
            }
            return;
          }
          // not found / expired id → fall through to a fresh draft
        } catch {
          /* network error → fresh draft */
        }
      }
      // No id (or unusable): start fresh. We do NOT create a Build row here —
      // usePersistBuild creates it lazily on the first real change, so merely
      // opening /builder never spawns an empty "Untitled" draft.
      if (!cancelled) setResume({ seed: undefined, stepIndex: 0 });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (resume === null) {
    return <div style={{ minHeight: '100vh', background: PALETTE.bone }} />;
  }

  return (
    <BuilderProvider seed={resume.seed}>
      <WizardProvider initialStepIndex={resume.stepIndex}>
        <PersistGate buildId={buildId}>
          {/* Locked app-shell: the builder fills the viewport and never
              body-scrolls — the header stays on top, the bottom action bar stays
              pinned, and only the step content scrolls (inside Wizard). */}
          <div
            style={{
              height: '100dvh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              background: PALETTE.bone,
              color: PALETTE.espresso,
            }}
          >
            <TopBar />
            <Wizard />
          </div>
        </PersistGate>
      </WizardProvider>
    </BuilderProvider>
  );
}

// Mounted inside the providers so the save hook can read builder + wizard context.
function PersistGate({ buildId, children }: { buildId: string | null; children: React.ReactNode }) {
  usePersistBuild(buildId);
  return <>{children}</>;
}
