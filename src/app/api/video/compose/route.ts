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
//   3. Probe durations to compute exact targetLength = max(videoContentLength, narrationLength)
//   4. Build ONE ffmpeg command with a filter_complex that:
//      - Scales/pads every input to the target canvas (W×H, 30fps, yuv420p)
//      - Concatenates all visual inputs with concat filter
//      - Pads video tail by videoDeficit (clone last frame) when narration is longer
//      - Mixes optional audio (narration + music bed, music ducked -18dB),
//        trims both tracks to targetLength, re-encodes to aac 192k
//   5. Upload out.mp4 to fal.storage, return { url }
//   6. Clean ALL temp files in finally block
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
//   perBeatMs?: number,   // trims each beat video to this duration so total length ≈ targetMinutes
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

// ---- Narration audio processing constants ------------------------------------
// Applied only to the narration track, never to music.
const NARR_VOLUME        = "volume=1.0";
const NARR_HIGHPASS      = "highpass=f=80";
const NARR_EQ_LOW        = "equalizer=f=200:t=q:w=1.0:g=2";
const NARR_EQ_HIGH       = "equalizer=f=3200:t=q:w=2.0:g=-2.5";
const NARR_ECHO_IN_GAIN  = 0.85;
const NARR_ECHO_OUT_GAIN = 0.18;
const NARR_ECHO_DELAY    = 55;
const NARR_ECHO_DECAY    = 0.18;
const NARR_LIMITER_LIMIT = 0.95;
const NARR_POST =
  `${NARR_VOLUME},${NARR_HIGHPASS},${NARR_EQ_LOW},${NARR_EQ_HIGH},` +
  `aecho=${NARR_ECHO_IN_GAIN}:${NARR_ECHO_OUT_GAIN}:${NARR_ECHO_DELAY}:${NARR_ECHO_DECAY},` +
  `alimiter=limit=${NARR_LIMITER_LIMIT}`;

// Music duck level — -18 dB ≈ 0.126 linear
const MUSIC_DUCK_VOLUME = 0.126;

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
  narrationDurationMs?: number | null;
  aspectRatio?: "9:16" | "16:9" | "1:1";
  perBeatMs?: number;
  cardMs?: number;
  captionMs?: number;
}

interface Segment {
  kind: "image" | "video";
  url: string;
  durationSec?: number; // images: display duration; videos: trim duration (perBeatSec)
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

// Probe the duration of a local media file using ffprobe.
// On any failure (non-zero exit, ENOENT, NaN) resolves to 0 — never rejects.
function probeDurationSec(filePath: string): Promise<number> {
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
        process.stderr.write(`probeDurationSec(${filePath}) exited ${code}: ${stderr.slice(-200)}\n`);
        resolve(0);
        return;
      }
      const v = parseFloat(stdout.trim());
      if (isNaN(v)) {
        process.stderr.write(`probeDurationSec(${filePath}) non-numeric output: ${stdout.trim()}\n`);
        resolve(0);
        return;
      }
      resolve(v);
    });
    proc.on("error", (err) => {
      process.stderr.write(`probeDurationSec(${filePath}) spawn failed: ${err.message}\n`);
      resolve(0);
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
  const perBeatMs = body.perBeatMs ?? null;
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
      segments.push({ kind: "video", url: beat.videoUrl, durationSec: perBeatMs ? perBeatMs / 1000 : undefined });
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

  const narrationUrl = body.narrationUrl || null;
  const musicUrl = body.musicUrl || null;
  if (narrationUrl && !validateStorageUrl(narrationUrl)) {
    return NextResponse.json({ error: "invalid narration url" }, { status: 400 });
  }
  if (musicUrl && !validateStorageUrl(musicUrl)) {
    return NextResponse.json({ error: "invalid music url" }, { status: 400 });
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

    // Compute videoContentLength: sum of all segment durations.
    // Image segments always have durationSec. Beat-video segments use their
    // trim duration when set; otherwise probe the downloaded file.
    let videoContentLength = 0;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.durationSec != null) {
        videoContentLength += seg.durationSec;
      } else {
        // video segment with no trim — probe actual duration
        videoContentLength += await probeDurationSec(localPaths[i]);
      }
    }

    let narrationPath: string | null = null;
    let musicPath: string | null = null;
    if (narrationUrl) {
      narrationPath = await downloadToTmp(narrationUrl, `compose_narration_${now}.mp3`);
      tmpFiles.push(narrationPath);
    }
    if (musicUrl) {
      musicPath = await downloadToTmp(musicUrl, `compose_music_${now}.mp3`);
      tmpFiles.push(musicPath);
    }

    // Derive narration length: prefer the pre-probed value forwarded from the client
    // (more reliable than a server-side ffprobe on a freshly-downloaded file).
    const bodyNarrationSec = (body.narrationDurationMs ?? 0) > 0
      ? (body.narrationDurationMs as number) / 1000
      : 0;
    const narrationLength = narrationPath
      ? (bodyNarrationSec > 0 ? bodyNarrationSec : await probeDurationSec(narrationPath))
      : 0;
    const targetLength = Math.max(videoContentLength, narrationLength);
    const videoDeficit = targetLength - videoContentLength;

    // Build ffmpeg args array programmatically
    const args: string[] = ["-y"];

    // Inputs: image segments get -loop 1 -t <duration>.
    // Video segments get -t <durationSec> when perBeatMs was supplied, otherwise play full length.
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.kind === "image") {
        args.push("-loop", "1", "-t", String(seg.durationSec!), "-i", localPaths[i]);
      } else if (seg.durationSec != null) {
        args.push("-t", String(seg.durationSec), "-i", localPaths[i]);
      } else {
        args.push("-i", localPaths[i]);
      }
    }

    // Audio inputs last. Narration plays once; the music bed loops to fill the full length.
    if (narrationPath) {
      args.push("-i", narrationPath);
    }
    if (musicPath) {
      args.push("-stream_loop", "-1", "-i", musicPath);
    }

    // Build filter_complex: scale/pad each input to canvas, then concat, then pad video.
    const filterParts: string[] = [];
    for (let k = 0; k < segments.length; k++) {
      filterParts.push(
        `[${k}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,` +
        `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v${k}]`
      );
    }
    const concatInputs = segments.map((_, k) => `[v${k}]`).join("");
    filterParts.push(`${concatInputs}concat=n=${segments.length}:v=1:a=0[concatv]`);

    // Pad video tail only when narration outlasts the visual content.
    if (videoDeficit > 0.05) {
      filterParts.push(
        `[concatv]tpad=stop_mode=clone:stop_duration=${videoDeficit.toFixed(3)}[outv]`
      );
    } else {
      filterParts.push(`[concatv]copy[outv]`);
    }

    // Audio mix — four cases, all trimmed to targetLength.
    // Case A: narration + music
    // Case B: narration only
    // Case C: music only
    // Case D: no audio (handled outside filter_complex)
    const narrationIndex = narrationPath ? segments.length : -1;
    const musicIndex = musicPath ? segments.length + (narrationPath ? 1 : 0) : -1;
    const hasAudio = narrationPath !== null || musicPath !== null;
    const tLen = targetLength.toFixed(3);

    if (narrationPath && musicPath) {
      // Case A: narration + music, music ducked
      filterParts.push(
        `[${narrationIndex}:a]${NARR_POST},apad=whole_dur=${tLen},atrim=0:${tLen},asetpts=N/SR/TB[na]`,
        `[${musicIndex}:a]volume=${MUSIC_DUCK_VOLUME},atrim=0:${tLen},asetpts=N/SR/TB[ma]`,
        `[na][ma]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[aout]`
      );
    } else if (narrationPath) {
      // Case B: narration only
      filterParts.push(
        `[${narrationIndex}:a]${NARR_POST},apad=whole_dur=${tLen},atrim=0:${tLen},asetpts=N/SR/TB[aout]`
      );
    } else if (musicPath) {
      // Case C: music only at full volume, trimmed to video length
      filterParts.push(
        `[${musicIndex}:a]volume=1.0,atrim=0:${tLen},asetpts=N/SR/TB[aout]`
      );
    }

    args.push("-filter_complex", filterParts.join(";"));
    args.push("-map", "[outv]");

    if (hasAudio) {
      args.push(
        "-map", "[aout]",
        "-c:a", "aac",
        "-b:a", "192k",
      );
    } else {
      args.push("-an");
    }

    // Hard cap at targetLength so no track can creep past the computed length.
    args.push("-t", targetLength.toFixed(3));

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
    const status = 502;
    return NextResponse.json({ error: message }, { status });
  } finally {
    for (const p of tmpFiles) {
      try { fs.unlinkSync(p); } catch { /* best-effort cleanup */ }
    }
  }
}
