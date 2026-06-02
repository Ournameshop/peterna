// POST /api/build — create a new builder draft, returns { id }.
//
// Persistence is additive: the entire BuilderState is stored as one JSON blob.
// A missing DATABASE_URL is not fatal to the wizard — the client treats a
// failed create as "no persistence this session" and keeps working.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ReqBody {
  state?: Record<string, unknown>;
  stepIndex?: number;
}

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }

  let body: ReqBody = {};
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    // Empty / invalid body → create an empty draft.
  }

  const state = (body.state ?? {}) as Record<string, unknown>;
  const petName = typeof state.petName === 'string' && state.petName.trim() ? state.petName.trim() : null;

  try {
    const build = await prisma.build.create({
      data: {
        state: state as object,
        stepIndex: typeof body.stepIndex === 'number' ? body.stepIndex : 0,
        petName,
      },
      select: { id: true },
    });
    return NextResponse.json({ id: build.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'database error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
