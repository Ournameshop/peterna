// POST /api/video/music
// Generates an instrumental music bed for the tribute.
// PRIMARY: Suno (sunoapi.org) — instrumental, no vocals.
// FALLBACK: fal-ai/elevenlabs/music — used when SUNO_API_KEY is absent or Suno fails.
//
// Body: { prompt: string, durationSeconds?: number }
// Response: { url: string, durationMs: number }

import { NextResponse } from "next/server";
import { fal } from "@/lib/fal";
import { sunoGenerateInstrumental } from "@/lib/suno";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Suno polling can take up to ~3 min

interface ReqBody {
  prompt?: string;
  durationSeconds?: number;
}

interface MusicOutput {
  audio: { url: string };
}

export async function POST(req: Request) {
  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const durationSeconds = body.durationSeconds ?? 180;

  // PRIMARY: Suno
  if (process.env.SUNO_API_KEY) {
    try {
      const result = await sunoGenerateInstrumental(prompt, durationSeconds);
      return NextResponse.json(result);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[music] Suno failed, falling back to fal:", err);
    }
  }

  // FALLBACK: fal-ai/elevenlabs/music
  if (!process.env.FAL_KEY) {
    return NextResponse.json(
      { error: "No music provider configured (SUNO_API_KEY and FAL_KEY both missing)" },
      { status: 500 }
    );
  }

  // Clamp to ElevenLabs music model limits: 3,000ms–600,000ms.
  const requestedMs = Math.round(durationSeconds * 1000);
  const music_length_ms = Math.min(600000, Math.max(3000, requestedMs));

  try {
    const result = await fal.subscribe("fal-ai/elevenlabs/music", {
      input: {
        prompt,
        force_instrumental: true,
        music_length_ms,
      },
      logs: false,
    });
    const url = (result?.data as unknown as MusicOutput)?.audio?.url;
    if (!url) {
      return NextResponse.json({ error: "no audio url in fal response" }, { status: 502 });
    }
    return NextResponse.json({ url, durationMs: music_length_ms });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
