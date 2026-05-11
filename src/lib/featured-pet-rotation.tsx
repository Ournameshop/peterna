"use client";

// Shared rotation state for the home hero. The hero background and the
// FeaturedPortrait card both read from this so they always show the SAME
// pet — background blurred/darkened, foreground sharp. This replaces the
// previous setup where the hero background ran its own 6-slide carousel
// (Gemini stills) on a different rhythm and showed a completely different
// animal than the foreground portrait card.
//
// Locked rhythm (Andre, 2026-05-11):
//   - 8s per pet (same as old FeaturedPortrait cadence)
//   - 1.5s crossfade on the foreground card
//   - Background re-uses the same image but blurred + darkened, fading
//     together with the card so the two never desync.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useReducedMotion } from "framer-motion";
import { FEATURED_PETS } from "@/lib/pets";

type Ctx = {
  index: number;
  pet: (typeof FEATURED_PETS)[number];
  total: number;
  goTo: (next: number) => void;
};

const FeaturedPetRotationContext = createContext<Ctx | null>(null);

type ProviderProps = {
  children: ReactNode;
  /** ms each pet stays on screen (default 8000). */
  intervalMs?: number;
};

export function FeaturedPetRotationProvider({
  children,
  intervalMs = 8000,
}: ProviderProps) {
  const prefersReducedMotion = useReducedMotion();
  const total = FEATURED_PETS.length;

  // Random start so different visitors meet different pets first.
  const [index, setIndex] = useState(() =>
    total > 0 ? Math.floor(Math.random() * total) : 0,
  );

  const goTo = useCallback(
    (next: number) => {
      if (total === 0) return;
      const wrapped = ((next % total) + total) % total;
      setIndex(wrapped);
    },
    [total],
  );

  useEffect(() => {
    if (prefersReducedMotion) return;
    if (total <= 1) return;
    const id = window.setTimeout(() => {
      setIndex((i) => (i + 1) % total);
    }, intervalMs);
    return () => window.clearTimeout(id);
  }, [index, intervalMs, prefersReducedMotion, total]);

  const value = useMemo<Ctx>(
    () => ({ index, pet: FEATURED_PETS[index], total, goTo }),
    [index, total, goTo],
  );

  return (
    <FeaturedPetRotationContext.Provider value={value}>
      {children}
    </FeaturedPetRotationContext.Provider>
  );
}

export function useFeaturedPetRotation(): Ctx {
  const ctx = useContext(FeaturedPetRotationContext);
  if (!ctx) {
    throw new Error(
      "useFeaturedPetRotation must be used inside <FeaturedPetRotationProvider>",
    );
  }
  return ctx;
}
