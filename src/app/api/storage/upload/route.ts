// POST /api/storage/upload
// Accepts multipart/form-data with a `file` field, uploads to fal storage,
// returns the public URL.
//
// Caveat (per migration spec §5): fal storage is fine for ephemeral
// references during a session. For permanent memorial-page assets we'll
// need our own CDN — flagged as a follow-up.

import { NextResponse } from "next/server";
import { fal } from "@/lib/fal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!process.env.FAL_KEY) {
    return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json(
        { error: "file field required (multipart/form-data)" },
        { status: 400 }
      );
    }
    const url = await fal.storage.upload(file);
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
