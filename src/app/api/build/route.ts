// GET  /api/build — list saved drafts (newest first) for the "continue" picker.
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

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }
  try {
    // Light list — no `state` blob (can be large with data URLs). `hasVideo`
    // tells the picker whether a finished video exists without shipping it.
    const rows = await prisma.build.findMany({
      // Hide untouched drafts (no name AND still on the first step) so the
      // picker isn't cluttered with empty "Untitled" rows.
      where: { NOT: { AND: [{ petName: null }, { stepIndex: 0 }] } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: { id: true, petName: true, stepIndex: true, updatedAt: true },
    });
    return NextResponse.json({ builds: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'database error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
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
