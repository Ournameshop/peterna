// Phase 13 — Peterna motion system.
//
// Single source of truth for transition durations, easing curves, and the
// reusable framer-motion variants that the builder components draw from.
//
// Why a shared system: 14 builder components were already using framer-motion
// piecemeal (whileHover/whileTap on most pills). Stage transitions and the
// big emotional reveals (character sheet, combination preview, final cut,
// eulogy) need a consistent rhythm — not 14 components each picking their
// own duration and curve.
//
// Naming follows visual feel, not category:
//   - instant: a touch echo (button taps already feel "spring-y" — this is
//     for the rare case we want a CSS-style fade with no spring).
//   - quick:   typical micro-interaction fade (loading spinner out, etc.).
//   - base:    standard panel-to-panel transitions.
//   - slow:    reveals + settling — the breath, the gentle scale-in.
//   - long:    "drumroll" reveals — the character sheet appearing.
//
// EASE values are cubic-bezier tuples matching framer-motion's API. We
// keep three: `soft` (Material-style smooth in/out — the default for
// everything panel-level), `crisp` (snappier — exits and overlays),
// `reveal` (the "settle" curve — long ease-out for the reveal moments).

import type { Variants } from "framer-motion";

// Seconds — framer-motion's `transition.duration` reads seconds.
export const DURATION = {
  instant: 0.12,
  quick: 0.24,
  base: 0.36,
  slow: 0.56,
  long: 0.84,
} as const;

// Cubic-bezier tuples — typed as readonly 4-tuples so framer-motion accepts
// them directly via `ease: EASE.reveal`.
export const EASE = {
  soft: [0.22, 1, 0.36, 1] as const,
  crisp: [0.4, 0, 0.2, 1] as const,
  reveal: [0.16, 1, 0.3, 1] as const,
} as const;

// -----------------------------------------------------------------------------
// prefers-reduced-motion helper.
//
// Returns a boolean snapshot. Safe to call from anywhere — SSR returns false
// (we don't degrade animations on the server; the client takes over on
// hydrate). Callers can pipe this into the helpers below to zero out
// durations and presence motion.
// -----------------------------------------------------------------------------

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Zero-duration transition — used by the variant helpers when the user has
// reduced-motion enabled. We don't strip animations entirely (state still
// changes); we just collapse their time so motion is effectively instant.
const REDUCED_TRANSITION = { duration: 0 } as const;

// -----------------------------------------------------------------------------
// Variants — designed to be passed to <motion.div variants={...} initial="…">.
// Each variant has `hidden` / `visible` / (optionally `exit`) states.
// -----------------------------------------------------------------------------

// Fade up — the workhorse. Below-the-fold content sliding into view.
export function fadeUp(distance = 8): Variants {
  const reduced = prefersReducedMotion();
  return {
    hidden: { opacity: 0, y: reduced ? 0 : distance },
    visible: {
      opacity: 1,
      y: 0,
      transition: reduced
        ? REDUCED_TRANSITION
        : { duration: DURATION.base, ease: EASE.soft },
    },
    exit: {
      opacity: 0,
      y: reduced ? 0 : -distance / 2,
      transition: reduced
        ? REDUCED_TRANSITION
        : { duration: DURATION.quick, ease: EASE.crisp },
    },
  };
}

// Pure opacity — for cross-fades.
export function fadeIn(): Variants {
  const reduced = prefersReducedMotion();
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: reduced
        ? REDUCED_TRANSITION
        : { duration: DURATION.base, ease: EASE.soft },
    },
    exit: {
      opacity: 0,
      transition: reduced
        ? REDUCED_TRANSITION
        : { duration: DURATION.quick, ease: EASE.crisp },
    },
  };
}

// Scale-in — for the cards / reveals that should feel like they "settle" into
// place. Subtle: 0.97 → 1 is intentional; bigger scales look bouncy and
// undermine the calm voice we're going for.
export function scaleIn(from = 0.97): Variants {
  const reduced = prefersReducedMotion();
  return {
    hidden: { opacity: 0, scale: reduced ? 1 : from },
    visible: {
      opacity: 1,
      scale: 1,
      transition: reduced
        ? REDUCED_TRANSITION
        : { duration: DURATION.slow, ease: EASE.reveal },
    },
    exit: {
      opacity: 0,
      scale: reduced ? 1 : from,
      transition: reduced
        ? REDUCED_TRANSITION
        : { duration: DURATION.quick, ease: EASE.crisp },
    },
  };
}

// Stagger container — pair with a child variant so children cascade in.
export function staggerChildren(stagger = 0.06, delayChildren = 0.04): Variants {
  const reduced = prefersReducedMotion();
  return {
    hidden: {},
    visible: {
      transition: reduced
        ? REDUCED_TRANSITION
        : {
            staggerChildren: stagger,
            delayChildren,
          },
    },
    exit: {},
  };
}

// The "drumroll" reveal — used for the character sheet first appearance and
// other big moments. Longer duration, the reveal ease, a slightly deeper
// scale-in (0.97 → 1) so it feels like the artifact is settling in front of
// the user rather than just popping into existence.
export function revealPanel(): Variants {
  const reduced = prefersReducedMotion();
  return {
    hidden: { opacity: 0, scale: reduced ? 1 : 0.97, y: reduced ? 0 : 6 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: reduced
        ? REDUCED_TRANSITION
        : { duration: DURATION.long, ease: EASE.reveal },
    },
    exit: {
      opacity: 0,
      scale: reduced ? 1 : 0.99,
      transition: reduced
        ? REDUCED_TRANSITION
        : { duration: DURATION.quick, ease: EASE.crisp },
    },
  };
}

// A tiny "breath" — used as `animate={breathPulse()}` on artifacts after they
// reveal. Reads as the artifact settling rather than holding stiff.
// Designed to run once via `transition.repeat: 0` (default).
export function breathPulse() {
  if (prefersReducedMotion()) {
    return { scale: 1 };
  }
  return {
    scale: [1, 1.005, 1],
    transition: { duration: DURATION.slow, ease: EASE.soft, times: [0, 0.5, 1] },
  };
}
