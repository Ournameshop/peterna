// Server-side fal.ai client.
// IMPORTANT: never import this file from a client component.
// It reads FAL_KEY from process.env at module load.

import { fal } from "@fal-ai/client";

if (!process.env.FAL_KEY) {
  // We throw lazily so build doesn't fail when keys aren't set in CI build step
  // (Next pre-renders some routes at build time without runtime env).
  // The first runtime call from a route handler will surface this clearly.
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_PHASE !== "phase-production-build") {
    // eslint-disable-next-line no-console
    console.warn("[fal] FAL_KEY not set — calls will fail at runtime until configured.");
  }
} else {
  fal.config({ credentials: process.env.FAL_KEY });
}

export { fal };
