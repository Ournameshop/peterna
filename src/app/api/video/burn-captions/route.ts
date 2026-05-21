// POST /api/video/burn-captions
// For each beat with a captionOverlayUrl, composites the transparent PNG over
// the clip via ffmpeg, uploads the result to fal storage, and returns burned URLs.
// Beats without a captionOverlayUrl are passed through unchanged.
//
// Requires ffmpeg on the host (EC2/PM2 box) — `apt-get install -y ffmpeg`
//
// Body: { beats: Array<{ index: number, videoUrl: string, captionOverlayUrl?: string }> }
// Response: { beats: Array<{ index: number, burnedVideoUrl: string }> }

import { NextResponse } from "next/server";
import os from "os";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { fal } from "@/lib/fal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface BeatIn {
  index: number;
  videoUrl: string;
  captionOverlayUrl?: string;
}

interface BeatOut {
  index: number;
  burnedVideoUrl: string;
}

interface ReqBody {
  beats?: BeatIn[];
}

// Accepts only https URLs. Fal storage hostnames vary; enforce https only to
// avoid over-restricting legitimate fal URLs while still blocking SSRF vectors.
function validateStorageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function downloadToTmp(url: string, filename: string): Promise<string> {
  const dest = path.join(os.tmpdir(), filename);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${url} (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return dest;
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: "pipe" });
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`));
    });
    proc.on("error", (err) => reject(new Error(`ffmpeg spawn failed: ${err.message}`)));
  });
}

export async function POST(req: Request) {
  if (!process.env.FAL_KEY) {
    return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 });
  }

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const beats = body.beats ?? [];
  if (beats.length === 0) {
    return NextResponse.json({ error: "beats must be a non-empty array" }, { status: 400 });
  }

  for (const beat of beats) {
    if (!Number.isInteger(beat.index) || beat.index < 0 || beat.index > 999) {
      return NextResponse.json({ error: `invalid beat index: ${beat.index}` }, { status: 400 });
    }
    if (!validateStorageUrl(beat.videoUrl)) {
      return NextResponse.json({ error: `invalid videoUrl for beat ${beat.index}` }, { status: 400 });
    }
    if (beat.captionOverlayUrl !== undefined && !validateStorageUrl(beat.captionOverlayUrl)) {
      return NextResponse.json({ error: `invalid captionOverlayUrl for beat ${beat.index}` }, { status: 400 });
    }
  }

  const results: BeatOut[] = [];

  for (const beat of beats) {
    if (!beat.captionOverlayUrl) {
      results.push({ index: beat.index, burnedVideoUrl: beat.videoUrl });
      continue;
    }

    const id = `beat_${beat.index}_${Date.now()}`;
    const clipPath = path.join(os.tmpdir(), `${id}_clip.mp4`);
    const overlayPath = path.join(os.tmpdir(), `${id}_overlay.png`);
    const outPath = path.join(os.tmpdir(), `${id}_out.mp4`);

    try {
      await Promise.all([
        downloadToTmp(beat.videoUrl, `${id}_clip.mp4`),
        downloadToTmp(beat.captionOverlayUrl, `${id}_overlay.png`),
      ]);

      await runFfmpeg([
        "-y",
        "-i", clipPath,
        "-i", overlayPath,
        "-filter_complex", "[0][1]overlay=0:0:format=auto",
        "-c:a", "copy",
        outPath,
      ]);

      const videoData = fs.readFileSync(outPath);
      const blob = new Blob([videoData], { type: "video/mp4" });
      const burnedVideoUrl = await fal.storage.upload(blob);
      results.push({ index: beat.index, burnedVideoUrl });
    } catch (err) {
      const message = err instanceof Error ? err.message : "burn failed";
      return NextResponse.json({ error: message }, { status: 502 });
    } finally {
      for (const p of [clipPath, overlayPath, outPath]) {
        try { fs.unlinkSync(p); } catch { /* best-effort cleanup */ }
      }
    }
  }

  return NextResponse.json({ beats: results });
}
