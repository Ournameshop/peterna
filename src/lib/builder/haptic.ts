// Phase 13 — Haptic feedback helpers.
//
// Three textures, each tuned for a different moment:
//
//   tap()        — single 10ms vibration. Micro-affordance on pill selection.
//                  Reads as "the device noticed you tapped" — never as alarm.
//   confirm()    — short three-pulse pattern. Used on gate approvals — when
//                  the user says "looks great." The pattern reads as a soft
//                  affirmation, not a buzz.
//   completion() — five-pulse crescendo ending on a longer hold. Reserved
//                  for the delivery-ready moment — the one place where we
//                  actually want the user's body to register that something
//                  meaningful just happened.
//
// Browser/platform notes:
//   - iOS Safari does NOT implement `navigator.vibrate`. These helpers
//     gracefully no-op there — no try/catch, just a typeof check.
//   - Android Chrome + most desktop Chromiums honor it. Firefox honors on
//     Android only.
//   - Spec requires a user-gesture context, which is always true for our
//     callers (we only trigger from click handlers / mount-after-gesture).
//
// We intentionally do NOT wrap in try/catch. The spec defines the API as
// best-effort — if the platform doesn't support it, navigator.vibrate is
// undefined and we return early; if it returns false (some platforms do for
// e.g. quiet hours), that's also fine, the user didn't want it then.

function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  navigator.vibrate(pattern);
}

/** Micro-tap — confirms pill selection, chip taps, etc. */
export function tap(): void {
  vibrate(10);
}

/** Affirmation pattern — gate "looks great" / approval moments. */
export function confirm(): void {
  vibrate([20, 30, 20]);
}

/** Crescendo — reserved for the delivery-ready moment. Used once per session. */
export function completion(): void {
  vibrate([40, 60, 80, 60, 200]);
}
