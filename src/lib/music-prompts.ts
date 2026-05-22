// Shared music prompt builder — used by TheWords.tsx (TheWords stage) and
// FinishedTribute.tsx (auto-generate effect). Single source of truth.

import type { BuilderState } from '@/app/builder/state';
import {
  themes,
  relationships,
  personalityTraits,
  favoriteThings,
} from '@/lib/peternal-library';

function labelFromIds(
  ids: string[],
  source: readonly { id: string; label?: string; name?: string }[],
): string[] {
  return ids.map((id) => {
    const found = source.find((item) => item.id === id);
    return found?.label ?? found?.name ?? id.replace(/_/g, ' ');
  });
}

function listText(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export function buildInstrumentalPrompt(
  state: BuilderState,
  selectedTrackName?: string,
  selectedTrackMood?: string,
): string {
  const petName = state.petName || 'this beloved pet';
  const themeObj = themes.find((t) => t.id === state.theme);
  const relEntry = relationships.find((r) => r.id === state.relationship);
  const traitLabels = labelFromIds(state.traits, personalityTraits);
  const favoriteLabels = labelFromIds(state.favorites, favoriteThings);
  return [
    `Gentle instrumental memorial score for ${petName}.`,
    `No vocals. No lyrics.`,
    selectedTrackName ? `Track character: ${selectedTrackName}.` : null,
    selectedTrackMood ? `Mood: ${selectedTrackMood}.` : null,
    themeObj ? `Theme: ${themeObj.name}, ${themeObj.desc}.` : null,
    relEntry ? `Relationship tone: ${relEntry.narrationTone.replace(/_/g, ' ')}.` : null,
    traitLabels.length ? `Personality: ${listText(traitLabels)}.` : null,
    favoriteLabels.length ? `Loved: ${listText(favoriteLabels)}.` : null,
    state.memoryPromptAnswer ? `Memory feeling: ${state.memoryPromptAnswer}.` : null,
    `Soft, cinematic, restrained, emotionally warm, suitable under a pet tribute film.`,
  ]
    .filter(Boolean)
    .join(' ');
}
