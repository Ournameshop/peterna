import type { BuilderState } from '../state';

export function computeTributeAudioSeconds(state: BuilderState): number {
  const captionCardCount = state.words.captions.length;
  const cardsSeconds = 6 + captionCardCount * 2.5;
  return Math.ceil(state.targetMinutes * 60 + cardsSeconds);
}
