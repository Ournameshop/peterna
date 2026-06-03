"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { Sparkles, Hammer } from 'lucide-react';
import { PALETTE } from '../lib/palette';
import { StageShell, PathCard, Tag, Serif, Sans, SelectedBadge, SELECTED_BORDER, SELECTED_RING } from '../lib/primitives';
import { useBuilder } from '../state';
import type { StageProps } from '../state';
import { formats, themes, artStyles, themeCategories } from '@/lib/peternal-library';
import { orderCuratorsPicks, defaultThemeCategoryFor, defaultStyleFor } from '@/lib/peternal-resolvers';

export default function CuratorsPicks({ onNext, onBack, goToStep }: StageProps) {
  const { state, update } = useBuilder();
  const [mode, setMode] = useState<'choose' | 'curated' | null>(null);

  const petName = state.petName || 'them';
  const relationship = state.relationship ?? 'unspecified';
  const { ordered, highlightedId } = orderCuratorsPicks(relationship);

  function handleCurated() {
    setMode('curated');
  }

  function handleCustom() {
    update({
      pickType: 'custom',
      curatorsPick: null,
      themeCategory: defaultThemeCategoryFor(relationship),
      style: defaultStyleFor(relationship),
    });
    onNext();
  }

  function handlePickSelect(pickId: typeof ordered[number]['id']) {
    const pick = ordered.find(p => p.id === pickId);
    if (!pick) return;
    // Keep themeCategory in sync with the chosen theme — otherwise the Theme
    // step (3.3) highlights a category that doesn't contain the picked theme,
    // making the preselection look wrong/changed.
    const themeCat = themeCategories.find(c => c.themeIds.includes(pick.theme))?.id ?? null;
    update({
      pickType: 'curated',
      curatorsPick: pick.id,
      format: pick.format,
      theme: pick.theme,
      themeCategory: themeCat,
      style: pick.style,
    });
    goToStep('style_confirm');
  }

  if (mode === 'curated') {
    return (
      <StageShell
        eyebrow="Direction — 3.1"
        title="Which one feels right?"
        lede={highlightedId ? `The first pick is chosen especially for you, based on what ${petName} was to you.` : "Six carefully considered starting points."}
        onBack={() => setMode(null)}
        hideNext
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {ordered.map((pick) => {
            const themeObj = themes.find(t => t.id === pick.theme);
            const styleObj = artStyles.find(s => s.id === pick.style);
            const formatObj = formats.find(f => f.id === pick.format);
            const isHighlighted = pick.id === highlightedId;

            return (
              <button
                key={pick.id}
                onClick={() => handlePickSelect(pick.id)}
                style={{
                  position: 'relative',
                  textAlign: 'left',
                  padding: 0,
                  border: isHighlighted ? SELECTED_BORDER : `1px solid ${PALETTE.parchmentLight}`,
                  background: isHighlighted ? 'rgba(201,169,97,0.04)' : 'white',
                  boxShadow: isHighlighted ? SELECTED_RING : 'none',
                  cursor: 'pointer',
                  borderRadius: 4,
                  overflow: 'hidden',
                  transition: 'all 200ms ease',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = isHighlighted ? `${SELECTED_RING}, 0 8px 24px rgba(42,33,27,0.09)` : '0 8px 24px rgba(42,33,27,0.09)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'none'; (e.currentTarget as HTMLButtonElement).style.boxShadow = isHighlighted ? SELECTED_RING : 'none'; }}
              >
                {isHighlighted && <SelectedBadge />}
                <div style={{ position: 'relative', width: '100%', aspectRatio: '2 / 1', overflow: 'hidden', flexShrink: 0 }}>
                  <Image
                    src={`/curator-thumbnails/peterna-curator-${pick.id}.png`}
                    alt={`${pick.name} curator pick preview`}
                    fill
                    sizes="(max-width: 760px) calc(100vw - 48px), (max-width: 1200px) 40vw, 455px"
                    style={{ objectFit: 'cover' }}
                  />
                  {isHighlighted && (
                    <div style={{ position: 'absolute', top: 8, left: 8 }}>
                      <Sans style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', background: PALETTE.brass, color: 'white', padding: '3px 8px', borderRadius: 999 }}>
                        Recommended
                      </Sans>
                    </div>
                  )}
                </div>
                <div style={{ padding: '14px 16px 16px' }}>
                  {isHighlighted && (
                    <Serif italic style={{ fontSize: 12, color: PALETTE.brassDeep, marginBottom: 4 }}>
                      Based on what {petName} was to you
                    </Serif>
                  )}
                  <Serif style={{ fontSize: 18, color: PALETTE.espresso, marginBottom: 4 }}>{pick.name}</Serif>
                  <Serif italic style={{ fontSize: 13, color: PALETTE.mute, lineHeight: 1.4, marginBottom: 10 }}>{pick.tagline}</Serif>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {formatObj && <Tag>{formatObj.name}</Tag>}
                    {themeObj && <Tag>{themeObj.name}</Tag>}
                    {styleObj && <Tag>{styleObj.name}</Tag>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </StageShell>
    );
  }

  return (
    <StageShell
      eyebrow="Direction — 3.1"
      title="How would you like to begin?"
      lede={`We can suggest a thoughtful combination to start, or you can choose each element yourself.`}
      onBack={onBack}
      hideNext
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 680 }}>
        <PathCard
          title="Recommended picks"
          tagline="We'll suggest a combination chosen for your story. You can always adjust from there."
          icon={<Sparkles size={22} />}
          onClick={handleCurated}
          accent
        />
        <PathCard
          title="Build it myself"
          tagline="Choose your own format, theme, and art style — one step at a time."
          icon={<Hammer size={22} />}
          onClick={handleCustom}
        />
      </div>
    </StageShell>
  );
}
