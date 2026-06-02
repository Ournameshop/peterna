// GET  /api/build/[id] — load a draft → { id, state, stepIndex }
// PUT  /api/build/[id] — overwrite a draft with the full state blob
//
// PUT (not PATCH): the client always holds the entire BuilderState and sends it
// whole, so partial-merge semantics would only add complexity.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PutBody {
  state?: Record<string, unknown>;
  stepIndex?: number;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }
  const { id } = await ctx.params;
  try {
    const build = await prisma.build.findUnique({
      where: { id },
      select: { id: true, state: true, stepIndex: true },
    });
    if (!build) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json(build);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'database error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }
  const { id } = await ctx.params;

  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 });
  }
  if (!body.state || typeof body.state !== 'object') {
    return NextResponse.json({ error: 'state is required' }, { status: 400 });
  }

  const state = body.state as Record<string, unknown>;
  const petName = typeof state.petName === 'string' && state.petName.trim() ? state.petName.trim() : null;

  try {
    await prisma.build.update({
      where: { id },
      data: {
        state: state as object,
        stepIndex: typeof body.stepIndex === 'number' ? body.stepIndex : 0,
        petName,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Unknown id → 404 (don't 500). P2025 = record not found.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : 'database error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
