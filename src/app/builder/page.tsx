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

    async function createFresh() {
      try {
        const res = await fetch('/api/build', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stepIndex: 0 }),
        });
        if (res.ok) {
          const { id: newId } = (await res.json()) as { id: string };
          if (!cancelled) {
            // replaceState (not router) so the URL gains an id WITHOUT remounting
            // the provider tree (which would reset in-memory state = a flow change).
            window.history.replaceState(null, '', `?id=${newId}`);
            setBuildId(newId);
          }
        }
      } catch {
        /* persistence unavailable — the wizard still works, just without saving */
      }
    }

    (async () => {
      if (id) {
        try {
          const res = await fetch(`/api/build/${id}`, { cache: 'no-store' });
          if (res.ok) {
            const data = (await res.json()) as { id: string; state: BuilderState; stepIndex: number };
            if (!cancelled) {
              setBuildId(data.id);
              setResume({ seed: data.state, stepIndex: data.stepIndex ?? 0 });
            }
            return;
          }
          // not found / expired id → fall through to a fresh draft
        } catch {
          /* network error → fresh draft */
        }
      }
      // No id, or an unusable id: start fresh now; create the row in background.
      if (!cancelled) setResume({ seed: undefined, stepIndex: 0 });
      void createFresh();
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
          <div style={{ minHeight: '100vh', background: PALETTE.bone, color: PALETTE.espresso }}>
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
