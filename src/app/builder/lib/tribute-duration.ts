import type { BuilderState } from '../state';

export function computeTributeAudioSeconds(state: BuilderState): number {
  if (state.lockedDurationSeconds && state.lockedDurationSeconds > 0) {
    return Math.ceil(state.lockedDurationSeconds);
  }
  const captionCardCount = state.words.captions.length;
  const cardsSeconds = 6 + captionCardCount * 2.5;
  return Math.ceil(state.targetMinutes * 60 + cardsSeconds);
}
