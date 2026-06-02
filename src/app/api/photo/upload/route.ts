// POST /api/photo/upload — re-host an uploaded pet photo to durable storage.
//
// Body: multipart/form-data with `file`.
// Response: { url } — a durable URL (S3 when configured, else fal.storage).
//
// Pet photos were previously kept only as in-browser File/blob objects, so they
// were lost when a draft was saved + resumed (serializeState drops file/preview,
// keeps url). Uploading here and storing the returned `url` makes them persist
// and lets the character-sheet generation reference them on resume.
import { NextResponse } from "next/server";
import { fal } from "@/lib/fal";
import { store } from "@/lib/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  const name = file.name || "photo";
  const isHeic = /\.hei[cf]$/i.test(name);
  if (!file.type.startsWith("image/") && !isHeic) {
    return NextResponse.json({ error: "image file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file exceeds 25 MB limit" }, { status: 413 });
  }

  try {
    const bytes = await file.arrayBuffer();
    const ext = (name.split(".").pop() || "png").toLowerCase();
    // Durable S3 when configured; otherwise fall back to fal.storage so uploads
    // still work (and persist for ~24h) without AWS creds.
    const url =
      (await store(Buffer.from(bytes), file.type || "image/png", "pet-photo", ext)) ??
      (await fal.storage.upload(file));
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "upload failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
