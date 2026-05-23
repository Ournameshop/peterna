"use client";

import React from 'react';
import { Music, Music2 } from 'lucide-react';
import { PALETTE } from '../lib/palette';
import { StageShell, PathCard } from '../lib/primitives';
import { useBuilder } from '../state';
import type { StageProps } from '../state';

export default function MusicIntent({ onNext, onBack }: StageProps) {
  const { state, update, resetDownstream } = useBuilder();
  const petName = state.petName || 'your pet';

  function pick(intent: 'lyric' | 'standard') {
    if (state.musicIntent !== intent) {
      update({ musicIntent: intent });
      resetDownstream('music_intent');
    }
    onNext();
  }

  return (
    <StageShell
      eyebrow="Their likeness — 2.4"
      title={<>How do you want <em>music</em>?</>}
      lede="This shapes both the music and the tribute's length."
      onBack={onBack}
      hideNext
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 680 }}>
        <PathCard
          title="Lyric song"
          tagline={`A song with vocals about ${petName}. The song's length will be your tribute's length — perfectly synced, no fade-outs.`}
          icon={<Music size={22} />}
          onClick={() => pick('lyric')}
          accent={state.musicIntent === 'lyric'}
        />
        <PathCard
          title="Standard music"
          tagline="Instrumental, ambient, or upload your own — you'll choose the video length next."
          icon={<Music2 size={22} />}
          onClick={() => pick('standard')}
          accent={state.musicIntent === 'standard'}
        />
      </div>
    </StageShell>
  );
}
