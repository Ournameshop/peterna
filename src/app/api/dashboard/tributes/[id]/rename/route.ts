import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';

import { errJson, okJson } from '@/lib/api/respond';
import { readUserIdFromCookie } from '@/lib/auth/user-cookie';
import { buildTributeListItem } from '@/lib/dashboard/tribute-list-item';
import { getDb } from '@/lib/db/client';
import { sessions } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const PET_NAME_MIN = 1;
const PET_NAME_MAX = 60;

/**
 * POST /api/dashboard/tributes/[id]/rename (Phase 11)
 *
 * Body: `TributeRenameRequest` — `{ pet_name: string }`. Trim + length-check
 * (1..60 chars after trim). Updates `sessions.pet_name` only when the session
 * belongs to the signed-in user; any cross-user attempt returns 404 (we don't
 * distinguish "not yours" from "doesn't exist" — that's an info leak).
 */
export async function POST(req: NextRequest, ctx: RouteParams): Promise<Response> {
  const userId = await readUserIdFromCookie();
  if (!userId) return errJson('unauthenticated', { status: 401 });

  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return errJson('invalid-input', {
      status: 400,
      details: { issues: [{ message: 'json parse failed' }] },
    });
  }

  const raw = body.pet_name;
  if (typeof raw !== 'string') {
    return errJson('invalid-input', {
      status: 400,
      details: { field: 'pet_name', message: 'expected string' },
    });
  }
  const trimmed = raw.trim();
  if (trimmed.length < PET_NAME_MIN || trimmed.length > PET_NAME_MAX) {
    return errJson('invalid-input', {
      status: 400,
      details: {
        field: 'pet_name',
        message: `length must be ${PET_NAME_MIN}..${PET_NAME_MAX} chars after trim`,
      },
    });
  }

  const db = getDb();
  const updated = await db
    .update(sessions)
    .set({ petName: trimmed, updatedAt: new Date() })
    .where(and(eq(sessions.id, id), eq(sessions.userId, userId)))
    .returning();
  const row = updated[0];
  if (!row) return errJson('not-found', { status: 404 });

  const tribute = await buildTributeListItem(row);
  return okJson({ tribute });
}
