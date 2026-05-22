// POST /api/audio/upload
// Stores a user-provided audio file in fal storage so final server-side
// assembly can fetch it by HTTPS URL.

import { NextResponse } from "next/server";
import { fal } from "@/lib/fal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!process.env.FAL_KEY) {
    return NextResponse.json({ error: "FAL_KEY is required for audio uploads" }, { status: 500 });
  }

  const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!file.type.startsWith("audio/")) {
    return NextResponse.json({ error: "audio file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file exceeds 25 MB limit" }, { status: 413 });
  }

  const url = await fal.storage.upload(file);
  return NextResponse.json({ url, durationMs: 0, provider: "upload", title: file.name });
}
