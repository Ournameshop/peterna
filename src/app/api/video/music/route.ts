// POST /api/video/music
// Generates an instrumental music bed for the tribute using fal-ai/elevenlabs/music.
// The ElevenLabs music model supports up to 600,000ms (10 min), so no looping is needed
// server-side for a 2-4 minute tribute. Looping in the compose route handles edge cases.
//
// Body: { prompt: string, durationSeconds?: number }
// Response: { url: string, durationMs: number }

import { NextResponse } from "next/server";
import { fal, describeFalError } from "@/lib/fal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface ReqBody {
  prompt?: string;
  durationSeconds?: number;
}

interface MusicOutput {
  audio: { url: string };
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

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  // Clamp to ElevenLabs music model limits: 3,000ms–600,000ms.
  const requestedMs = Math.round((body.durationSeconds ?? 180) * 1000);
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
    const { message, status } = describeFalError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
