"use client";

// Footer slot for the builder's locked app-shell layout (ported in spirit from
// builder.blck's StepShell/StepActionBar): the wizard is pinned to the viewport
// (100dvh, overflow hidden) with a single internal scroll region; the bottom
// action bar lives in a LOCKED row below that region. StageShell renders its
// Back/Continue bar into this slot (via a portal) so it stays pinned at the
// viewport bottom while the step content scrolls — no position:sticky needed.
//
// Value is the slot's DOM element (or null before mount / when StageShell is
// used outside the wizard, in which case it falls back to an inline bar).
import { createContext, useContext } from "react";

export const WizardFooterContext = createContext<HTMLElement | null>(null);

export function useWizardFooterEl(): HTMLElement | null {
  return useContext(WizardFooterContext);
}
