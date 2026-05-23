"use client";

import React, { useState } from 'react';
import { PALETTE } from '../lib/palette';
import { StageShell, ChoiceCard, Serif } from '../lib/primitives';
import { useBuilder } from '../state';
import type { StageProps } from '../state';
import { themeCategories, themes } from '@/lib/peternal-library';
import type { ThemeCategoryId, ThemeId } from '@/lib/peternal-library';

// Themes that have a generated preview image in public/theme-thumbnails/.
// Themes not listed here fall back to the gradient swatch. All 12 are now
// generated — keep this set in sync with the asset folder.
const THEMES_WITH_THUMBNAILS = new Set<ThemeId>([
  'rainbow_bridge',
  'sunrise_reunion',
  'gentle_rain',
  'moonlight_vigil',
  'quiet_home',
  'beloved_places',
  'golden_meadow',
  'endless_shore',
  'forever_playful',
  'nap_champion',
  'starlit_reunion',
  'signs_and_symbols',
]);

export default function ThemePick({ onNext, onBack }: StageProps) {
  const { state, update } = useBuilder();
  const [subStep, setSubStep] = useState<0 | 1>(0);
  const [selectedCategory, setSelectedCategory] = useState<ThemeCategoryId | null>(state.themeCategory ?? null);

  function handleCategorySelect(catId: ThemeCategoryId) {
    setSelectedCategory(catId);
    update({ themeCategory: catId });
    setSubStep(1);
  }

  function handleThemeSelect(themeId: ThemeId) {
    update({ theme: themeId });
    onNext();
  }

  function handleBackFromThemes() {
    setSubStep(0);
  }

  if (subStep === 1 && selectedCategory) {
    const cat = themeCategories.find(c => c.id === selectedCategory);
    const catThemes = themes.filter(t => cat?.themeIds.includes(t.id));

    return (
      <StageShell
        eyebrow="Direction — 3.3"
        title={cat?.name ?? 'Choose a theme'}
        lede={cat?.desc}
        onBack={handleBackFromThemes}
        hideNext
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {catThemes.map(theme => {
            const isActive = state.theme === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => handleThemeSelect(theme.id)}
                style={{
                  textAlign: 'left',
                  padding: 0,
                  border: `1px solid ${isActive ? PALETTE.espresso : PALETTE.parchmentLight}`,
                  background: isActive ? PALETTE.boneSoft : 'white',
                  cursor: 'pointer',
                  borderRadius: 4,
                  overflow: 'hidden',
                  transition: 'all 200ms ease',
                  minHeight: 180,
                  display: 'flex',
                  flexDirection: 'column',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; if (!isActive) (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(42,33,27,0.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'none'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}
              >
                {THEMES_WITH_THUMBNAILS.has(theme.id) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/theme-thumbnails/peterna-theme-${theme.id}.png`}
                    alt={`${theme.name} theme preview`}
                    style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ height: 120, background: theme.gradient, flexShrink: 0 }} />
                )}
                <div style={{ padding: '14px 16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Serif style={{ fontSize: 20, color: PALETTE.espresso }}>{theme.name}</Serif>
                  <Serif italic style={{ fontSize: 13, color: PALETTE.mute, lineHeight: 1.4 }}>{theme.desc}</Serif>
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
      eyebrow="Direction — 3.3"
      title="What feeling should carry it?"
      lede="Each category opens into a few themes. You can preview them before deciding."
      onBack={onBack}
      hideNext
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {themeCategories.map(cat => (
          <ChoiceCard
            key={cat.id}
            emoji={cat.emoji}
            title={cat.name}
            desc={cat.desc}
            active={state.themeCategory === cat.id}
            onClick={() => handleCategorySelect(cat.id)}
          />
        ))}
      </div>
    </StageShell>
  );
}
