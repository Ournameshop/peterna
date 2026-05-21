import 'server-only';

import { v7 as uuidv7 } from 'uuid';

import { getDb } from '@/lib/db/client';
import { renders } from '@/lib/db/schema';

import type { VendorTag } from './types';

/**
 * Capabilities tracked in `renders.capability`. AI vendor calls use the
 * `generate_*` / `run_*` set; Phase 14 added local-only "renders" — ffmpeg
 * assembly + react-pdf eulogy — that have no vendor cost but do have a
 * latency / outcome story we want on the same audit log.
 */
export type RenderCapability =
  | 'generate_image'
  | 'run_vision_pass'
  | 'generate_video'
  | 'run_beat_sheet'
  | 'assembly'
  | 'eulogy_pdf';

/**
 * Vendor identifiers. AI vendors stay in `VendorTag`; local renderers
 * (ffmpeg, react-pdf) get their own opaque tags so the cost dashboard can
 * group by-capability cleanly without inventing fake AI vendors.
 */
export type RenderVendor = VendorTag | 'ffmpeg' | 'react_pdf';

export type LogRenderInput = {
  sessionId: string;
  stage: string;
  capability: RenderCapability;
  vendorAttempted: RenderVendor[];
  vendorServed: RenderVendor | null;
  model?: string;
  requestBody?: unknown;
  responseUrl?: string | null;
  costUsdEst?: number;
  durationMs: number;
  idempotencyKey: string;
  error?: string | null;
};

/** Insert one row into `renders` describing a vendor call's outcome. */
export async function logRender(input: LogRenderInput): Promise<void> {
  const db = getDb();
  await db.insert(renders).values({
    id: uuidv7(),
    sessionId: input.sessionId,
    stage: input.stage,
    capability: input.capability,
    vendorAttempted: input.vendorAttempted,
    vendorServed: input.vendorServed ?? null,
    model: input.model ?? null,
    requestBody: (input.requestBody as object | undefined) ?? null,
    responseUrl: input.responseUrl ?? null,
    costUsdEst: input.costUsdEst != null ? input.costUsdEst.toFixed(4) : null,
    durationMs: input.durationMs,
    error: input.error ?? null,
    idempotencyKey: input.idempotencyKey,
  });
}

/** Lightweight monotonic-ish timer; returns elapsed ms when called. */
export function startTimer(): () => number {
  const t0 = performance.now();
  return () => Math.round(performance.now() - t0);
}
