// POST /api/video/narration
// Generates a narration audio track from text using fal-ai/elevenlabs/tts/multilingual-v2.
//
// Body: { text: string, voice?: string }
// Response: { url: string }

import { NextResponse } from "next/server";
import os from "os";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { fal } from "@/lib/fal";
import { rehost } from "@/lib/server/storage";
import { serviceErrorResponse } from "@/lib/server/api-error";
import { normalizeTimestamps } from "@/lib/peternal-subtitles";
import type { NarrationWord } from "@/lib/peternal-subtitles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ElevenLabs voice quality tuning — tuned for a calm, gentle memorial read,
// NOT a performed/announcer delivery.
//   stability 0.82 — steady and even; minimal emotional swing or drama
//   style 0.0       — no expressiveness exaggeration; plain, quiet delivery
//   speed 0.82      — unhurried, measured, reverent
const ELEVENLABS_STABILITY        = 0.82;
const ELEVENLABS_SIMILARITY_BOOST = 0.80;
const ELEVENLABS_STYLE            = 0.0;
const ELEVENLABS_SPEED            = 0.82;

interface ReqBody {
  text?: string;
  voice?: string;
}

interface SpeechOutput {
  audio: { url: string };
  timestamps?: unknown;
}

function probeAudioDurationMs(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath,
    ], { stdio: "pipe" });
    let stdout = "";
    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.on("close", (code) => {
      if (code !== 0) { resolve(0); return; }
      const v = parseFloat(stdout.trim());
      resolve(isNaN(v) ? 0 : Math.round(v * 1000));
    });
    proc.on("error", () => resolve(0));
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

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  try {
    const result = await fal.subscribe("fal-ai/elevenlabs/tts/multilingual-v2", {
      input: {
        text,
        voice: body.voice ?? "Rachel",
        stability: ELEVENLABS_STABILITY,
        similarity_boost: ELEVENLABS_SIMILARITY_BOOST,
        style: ELEVENLABS_STYLE,
        speed: ELEVENLABS_SPEED,
        timestamps: true,
      },
      logs: false,
    });
    const data = result?.data as unknown as SpeechOutput;
    const url = data?.audio?.url;
    if (!url) {
      console.error("narration: missing audio.url in fal response:", JSON.stringify(result?.data));
      return NextResponse.json({ error: "fal returned no audio url", service: "fal" }, { status: 502 });
    }

    const timestamps: NarrationWord[] | null = normalizeTimestamps(data?.timestamps);

    // Probe duration so compose can use it authoritatively instead of re-probing.
    let durationMs = 0;
    const tmpAudio = path.join(os.tmpdir(), `narration_probe_${Date.now()}.mp3`);
    try {
      const audioRes = await fetch(url);
      if (audioRes.ok) {
        fs.writeFileSync(tmpAudio, Buffer.from(await audioRes.arrayBuffer()));
        durationMs = await probeAudioDurationMs(tmpAudio);
      }
    } catch {
      // probe failure is non-fatal — durationMs stays 0
    } finally {
      try { fs.unlinkSync(tmpAudio); } catch { /* best-effort */ }
    }

    // eslint-disable-next-line no-console
    console.log(`[GEN-NARRATION] url=${url} durationMs=${durationMs}`);
    const hostedUrl = await rehost(url, "narration", "mp3");
    return NextResponse.json({ url: hostedUrl, durationMs, timestamps });
  } catch (err) {
    return serviceErrorResponse("fal", err);
  }
}
