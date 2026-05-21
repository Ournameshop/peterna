// POST /api/video/compose
// Assembles the full tribute timeline — opening/closing card images, per-beat caption
// card images, beat videos, and an optional audio track — into a single video using
// a single server-side ffmpeg concat filter command that re-encodes all inputs to
// uniform parameters. This handles heterogeneous resolutions/fps/codecs robustly.
//
// REQUIRES ffmpeg on the host: apt-get install -y ffmpeg
// If ffmpeg is absent or exits non-zero, the route returns 502 — no silent degradation.
//
// Flow:
//   1. Build ordered segment list (openingCard → [captionCard → beatVideo]* → closingCard)
//   2. Download all segment files + audio to os.tmpdir()
//   3. Build ONE ffmpeg command with a filter_complex that:
//      - Scales/pads every input to the target canvas (W×H, 30fps, yuv420p)
//      - Concatenates all visual inputs with concat filter
//      - Maps optional audio (narration XOR music), re-encodes to aac 192k
//   4. Upload out.mp4 to fal.storage, return { url }
//   5. Clean ALL temp files in finally block
//
// Segment order: openingCard → [captionCard → beatVideo]* → closingCard
//
// Body: {
//   openingCardUrl: string | null,
//   closingCardUrl: string | null,
//   beats: Array<{ index: number, videoUrl?: string, captionCardUrl?: string }>,
//   musicUrl?: string | null,
//   narrationUrl?: string | null,
//   aspectRatio: "9:16" | "16:9" | "1:1",
//   perBeatMs?: number,   // accepted for API compatibility but unused — beat clips play full length
//   cardMs?: number,      // default 3000 — image display duration (ms)
//   captionMs?: number,   // default 2500 — caption card display duration (ms)
// }
// Response: { url: string }

import { NextResponse } from "next/server";
import os from "os";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { fal } from "@/lib/fal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface BeatEntry {
  index: number;
  videoUrl?: string;
  captionCardUrl?: string;
}

interface ReqBody {
  openingCardUrl?: string | null;
  closingCardUrl?: string | null;
  beats?: BeatEntry[];
  musicUrl?: string | null;
  narrationUrl?: string | null;
  aspectRatio?: "9:16" | "16:9" | "1:1";
  perBeatMs?: number; // unused — beat clips play their full intrinsic length
  cardMs?: number;
  captionMs?: number;
}

interface Segment {
  kind: "image" | "video";
  url: string;
  durationSec?: number; // only for images
}

// Accepts only https URLs.
function validateStorageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
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
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-600)}`));
    });
    proc.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new Error("ffmpeg not available on server — install with: apt-get install -y ffmpeg"));
      } else {
        reject(new Error(`ffmpeg spawn failed: ${err.message}`));
      }
    });
  });
}

function canvasForAspectRatio(ar: string): { W: number; H: number } {
  if (ar === "16:9") return { W: 1280, H: 720 };
  if (ar === "1:1")  return { W: 720,  H: 720 };
  return { W: 720, H: 1280 }; // 9:16 default
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

  const cardMs    = body.cardMs    ?? 3000;
  const captionMs = body.captionMs ?? 2500;
  const aspectRatio = body.aspectRatio ?? "9:16";
  const { W, H } = canvasForAspectRatio(aspectRatio);

  // Build ordered segment list
  const segments: Segment[] = [];

  if (body.openingCardUrl) {
    if (!validateStorageUrl(body.openingCardUrl)) {
      return NextResponse.json({ error: "invalid openingCardUrl" }, { status: 400 });
    }
    segments.push({ kind: "image", url: body.openingCardUrl, durationSec: cardMs / 1000 });
  }
  for (const beat of beats) {
    if (beat.captionCardUrl) {
      if (!validateStorageUrl(beat.captionCardUrl)) {
        return NextResponse.json({ error: `invalid captionCardUrl for beat ${beat.index}` }, { status: 400 });
      }
      segments.push({ kind: "image", url: beat.captionCardUrl, durationSec: captionMs / 1000 });
    }
    if (beat.videoUrl) {
      if (!validateStorageUrl(beat.videoUrl)) {
        return NextResponse.json({ error: `invalid videoUrl for beat ${beat.index}` }, { status: 400 });
      }
      segments.push({ kind: "video", url: beat.videoUrl });
    }
  }
  if (body.closingCardUrl) {
    if (!validateStorageUrl(body.closingCardUrl)) {
      return NextResponse.json({ error: "invalid closingCardUrl" }, { status: 400 });
    }
    segments.push({ kind: "image", url: body.closingCardUrl, durationSec: cardMs / 1000 });
  }

  if (segments.length === 0) {
    return NextResponse.json({ error: "no media segments to assemble" }, { status: 400 });
  }

  const audioUrl = body.narrationUrl || body.musicUrl || null;
  if (audioUrl && !validateStorageUrl(audioUrl)) {
    return NextResponse.json({ error: "invalid audio url" }, { status: 400 });
  }

  const now = Date.now();
  const tmpFiles: string[] = [];
  const outPath = path.join(os.tmpdir(), `compose_out_${now}.mp4`);

  try {
    // Download all segment files
    const localPaths: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const ext = seg.kind === "image" ? "png" : "mp4";
      const filename = `compose_seg_${now}_${i}.${ext}`;
      const p = await downloadToTmp(seg.url, filename);
      tmpFiles.push(p);
      localPaths.push(p);
    }

    let audioPath: string | null = null;
    if (audioUrl) {
      const ext = audioUrl.includes(".mp3") ? "mp3" : "m4a";
      audioPath = await downloadToTmp(audioUrl, `compose_audio_${now}.${ext}`);
      tmpFiles.push(audioPath);
    }

    // Build ffmpeg args array programmatically
    const args: string[] = ["-y"];

    // Inputs: image segments get -loop 1 -t <duration>, video segments just -i
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.kind === "image") {
        args.push("-loop", "1", "-t", String(seg.durationSec!), "-i", localPaths[i]);
      } else {
        args.push("-i", localPaths[i]);
      }
    }

    // Audio input last
    if (audioPath) {
      args.push("-i", audioPath);
    }

    // Build filter_complex: scale/pad each input to canvas, then concat
    const filterParts: string[] = [];
    for (let k = 0; k < segments.length; k++) {
      filterParts.push(
        `[${k}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,` +
        `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v${k}]`
      );
    }
    const concatInputs = segments.map((_, k) => `[v${k}]`).join("");
    filterParts.push(`${concatInputs}concat=n=${segments.length}:v=1:a=0[outv]`);

    args.push("-filter_complex", filterParts.join(";"));
    args.push("-map", "[outv]");

    if (audioPath) {
      const audioInputIndex = segments.length; // audio is the last input
      args.push(
        "-map", `${audioInputIndex}:a`,
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest"
      );
    } else {
      args.push("-an");
    }

    args.push(
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "20",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outPath
    );

    await runFfmpeg(args);

    tmpFiles.push(outPath);

    const videoData = fs.readFileSync(outPath);
    const blob = new Blob([videoData], { type: "video/mp4" });
    const url = await fal.storage.upload(blob);

    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    const status = message.includes("ffmpeg not available") ? 502 : 502;
    return NextResponse.json({ error: message }, { status });
  } finally {
    for (const p of tmpFiles) {
      try { fs.unlinkSync(p); } catch { /* best-effort cleanup */ }
    }
  }
}
