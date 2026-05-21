// Frontend-only descriptors for the Stage 5.7 DP overlay picker.
//
// This file is the UI label/secondary copy library — what the user sees in the
// pill picker at `cinematography_brief`. The engine logic / bias maps that
// transform a brief based on the chosen overlay are backend-owned and live in
// `src/lib/cinematography/dp-styles.ts` (separate concern, distinct module).
//
// Order in DP_STYLE_OVERLAYS is presentation order in the picker. We put
// "No specific style" first so it reads as a deliberate, dignified choice
// rather than a hidden default — most users will tap it, and burying it would
// nudge people toward a DP they've never heard of just because it's prominent.
//
// Secondary copy adapted from the v2.0 Cinematography Engine "DP style overlay"
// table in the spec (Part 4). One-line each — the table is already busy enough.

import type { DpStyleOverlayId } from '@/lib/builder/wire-types';

export type DpStyleOverlayDescriptor = {
  id: DpStyleOverlayId;
  label: string;
  /** 1-line description shown beneath the label in the pill picker. */
  secondary: string;
};

export const DP_STYLE_OVERLAYS: readonly DpStyleOverlayDescriptor[] = [
  {
    id: 'none',
    label: 'No specific style',
    secondary: 'Let the engine decide.',
  },
  {
    id: 'deakins_minimalist',
    label: 'Deakins — Minimalist',
    secondary: 'Locked-off frames, deep focus, classical composition.',
  },
  {
    id: 'lubezki_natural',
    label: 'Lubezki — Natural Light',
    secondary: 'Handheld, golden-hour, dappled sun.',
  },
  {
    id: 'young_intimate',
    label: 'Young — Intimate',
    secondary: 'Long lenses, shallow focus, candlelight.',
  },
  {
    id: 'khondji_painterly',
    label: 'Khondji — Painterly',
    secondary: 'Dreamy drifts, deep palettes, dust motes.',
  },
  {
    id: 'wong_kar_wai_dreamy',
    label: 'Wong Kar-wai — Dreamy',
    secondary: 'Slight slow-motion, candlelight, rack focus.',
  },
] as const;

/** Lookup helper — returns the descriptor for an overlay id, or `null`. */
export function findDpStyleOverlay(
  id: DpStyleOverlayId | null | undefined,
): DpStyleOverlayDescriptor | null {
  if (!id) return null;
  return DP_STYLE_OVERLAYS.find((d) => d.id === id) ?? null;
}
