import 'server-only';

import {
  FAVORITE_THINGS,
  PERSONALITY_TRAITS,
  type FavoriteThingId,
  type PersonalityTraitId,
} from '@/lib/library/intake';

/**
 * Map a list of personality-trait IDs to their human-readable labels, in the
 * order the user picked them. Unknown IDs are dropped (defensive — the wire
 * format is `text[]`, not a Drizzle enum, so a stale build could theoretically
 * carry an ID the library no longer ships).
 */
export function traitLabels(ids: readonly string[] | null | undefined): string[] {
  if (!ids || ids.length === 0) return [];
  const byId = new Map(PERSONALITY_TRAITS.map((t) => [t.id, t.label] as const));
  const out: string[] = [];
  for (const id of ids) {
    const label = byId.get(id as PersonalityTraitId);
    if (label) out.push(label);
  }
  return out;
}

/** Same shape as `traitLabels`, for favorite_things. */
export function favoriteLabels(ids: readonly string[] | null | undefined): string[] {
  if (!ids || ids.length === 0) return [];
  const byId = new Map(FAVORITE_THINGS.map((f) => [f.id, f.label] as const));
  const out: string[] = [];
  for (const id of ids) {
    const label = byId.get(id as FavoriteThingId);
    if (label) out.push(label);
  }
  return out;
}

/**
 * Join a list of phrases with Oxford-comma "X, Y, and Z" punctuation.
 * Empty list returns ''.
 */
export function joinList(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}
