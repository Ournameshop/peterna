import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ReqBody {
  petName?: string;
  videoUrl?: string;
  openingText?: string;
  closingText?: string;
  years?: string;
  creatorName?: string;
}

interface TributeRow {
  id: string;
}

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 });
  }

  const { petName, videoUrl, openingText, closingText, years, creatorName } = body;

  if (!petName || !petName.trim()) {
    return NextResponse.json({ error: 'petName is required' }, { status: 400 });
  }
  if (!videoUrl || !videoUrl.trim()) {
    return NextResponse.json({ error: 'videoUrl is required' }, { status: 400 });
  }

  try {
    const result = await query<TributeRow>(
      `INSERT INTO tributes (pet_name, video_url, opening_text, closing_text, years, creator_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [petName.trim(), videoUrl.trim(), openingText ?? null, closingText ?? null, years ?? null, creatorName ?? null],
    );
    return NextResponse.json({ id: result.rows[0].id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'database error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
