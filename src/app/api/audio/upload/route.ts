// POST /api/audio/upload
// Stores a user-provided audio file in fal storage so final server-side
// assembly can fetch it by HTTPS URL.

import { NextResponse } from "next/server";
import os from "os";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { fal } from "@/lib/fal";
import { store } from "@/lib/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function probeDurationMs(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath,
    ], { stdio: "pipe" });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      if (code !== 0) {
        process.stderr.write(`audio/upload probeDurationMs exited ${code}: ${stderr.slice(-200)}\n`);
        resolve(0);
        return;
      }
      const v = parseFloat(stdout.trim());
      if (isNaN(v)) {
        process.stderr.write(`audio/upload probeDurationMs non-numeric output: ${stdout.trim()}\n`);
        resolve(0);
        return;
      }
      resolve(Math.round(v * 1000));
    });
    proc.on("error", (err) => {
      process.stderr.write(`audio/upload probeDurationMs spawn failed: ${(err as Error).message}\n`);
      resolve(0);
    });
  });
}

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

  const ext = path.extname(file.name) || ".audio";
  const tmpPath = path.join(os.tmpdir(), `peterna-upload-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);

  // Read the upload ONCE — a File from formData() can be single-shot in some
  // runtimes; reuse the buffer for both the probe and the S3 store.
  const bytes = await file.arrayBuffer();

  let durationMs = 0;
  try {
    fs.writeFileSync(tmpPath, Buffer.from(bytes));
    durationMs = await probeDurationMs(tmpPath);
  } catch (err) {
    process.stderr.write(`audio/upload probe failed: ${(err as Error).message}\n`);
    durationMs = 0;
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* already gone */ }
  }

  const uploadExt = (file.name.split(".").pop() || "mp3").toLowerCase();
  const url =
    (await store(Buffer.from(bytes), file.type || "audio/mpeg", "upload", uploadExt)) ??
    (await fal.storage.upload(file));
  return NextResponse.json({ url, durationMs, provider: "upload", title: file.name });
}
