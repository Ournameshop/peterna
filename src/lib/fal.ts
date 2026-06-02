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

/**
 * Pull the most specific message + an appropriate HTTP status out of a fal error.
 *
 * The @fal-ai/client throws an ApiError whose `.message` is often just the
 * generic HTTP reason ("Forbidden"). The actionable detail lives in `.body`
 * (e.g. `{ detail: "User is locked. Reason: Exhausted balance. Top up..." }`
 * for a 403 billing lock, or `{ detail: [{ msg }] }` for validation errors).
 * Route handlers should surface THIS, not the bare "Forbidden".
 */
export function describeFalError(err: unknown): { message: string; status: number } {
  const anyErr = err as { status?: number; body?: unknown; message?: string } | null;
  const falStatus = typeof anyErr?.status === "number" ? anyErr.status : undefined;
  const body = anyErr?.body as { detail?: unknown; message?: string } | undefined;

  let message =
    err instanceof Error && err.message ? err.message : "unknown error";

  // Prefer fal's structured detail — that's where the real reason is.
  if (body) {
    const detail = body.detail;
    if (typeof detail === "string" && detail.trim()) {
      message = detail.trim();
    } else if (Array.isArray(detail) && detail.length) {
      const joined = detail
        .map((d) =>
          d && typeof d === "object" && "msg" in d
            ? String((d as { msg?: unknown }).msg)
            : String(d),
        )
        .filter(Boolean)
        .join("; ");
      if (joined) message = joined;
    } else if (typeof body.message === "string" && body.message.trim()) {
      message = body.message.trim();
    }
  }

  // Billing lock → 402 so the client can distinguish "out of credit" from a
  // transient upstream failure. Validation (422 etc.) passes through. Anything
  // else stays a 502 (upstream/gateway failure).
  let status = 502;
  if (/exhausted balance|user is locked|top up/i.test(message)) {
    status = 402; // Payment Required — fal account balance exhausted
  } else if (typeof falStatus === "number" && falStatus >= 400 && falStatus < 500 && falStatus !== 403) {
    status = falStatus;
  }

  return { message, status };
}
