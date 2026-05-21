import 'server-only';

import { v7 as uuidv7 } from 'uuid';

import { getDb } from '@/lib/db/client';
import { renders } from '@/lib/db/schema';

import type { VendorTag } from './types';

export type LogRenderInput = {
  sessionId: string;
  stage: string;
  capability: 'generate_image' | 'run_vision_pass' | 'generate_video';
  vendorAttempted: VendorTag[];
  vendorServed: VendorTag | null;
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
