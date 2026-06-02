// POST /api/video/music
// Generates an approved music track for the tribute.
// PRIMARY: Suno (sunoapi.org) for instrumental and lyric tracks.
// FALLBACK: fal-ai/elevenlabs/music for instrumental tracks only.
//
// Body: { prompt?: string, lyrics?: string, style?: string, title?: string, mode?: "instrumental"|"lyrics", durationSeconds?: number }
// Response: { url: string, durationMs: number, provider: "suno"|"fal", title?: string, stored?: boolean }

import { NextResponse } from "next/server";
import { fal } from "@/lib/fal";
import { store, rehost } from "@/lib/server/storage";
import { sunoGenerateTrack } from "@/lib/suno";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Suno polling can take up to ~3 min

interface ReqBody {
  mode?: "instrumental" | "lyrics";
  prompt?: string;
  lyrics?: string;
  style?: string;
  title?: string;
  durationSeconds?: number;
}

interface MusicOutput {
  audio: { url: string };
}

async function persistGeneratedAudio(url: string): Promise<{ url: string; stored: boolean }> {
  if (!process.env.FAL_KEY) return { url, stored: false };

  try {
    const audioRes = await fetch(url);
    if (!audioRes.ok) {
      throw new Error(`download failed: ${audioRes.status}`);
    }

    const contentType = audioRes.headers.get("content-type") || "audio/mpeg";
    const bytes = await audioRes.arrayBuffer();
    const storedUrl =
      (await store(Buffer.from(bytes), contentType, "music", "mp3")) ??
      (await fal.storage.upload(new Blob([bytes], { type: contentType })));
    return { url: storedUrl, stored: true };
  } catch (err) {
    console.warn("[music] failed to persist generated audio; using provider url:", err);
    return { url, stored: false };
  }
}

export async function POST(req: Request) {
  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const mode = body.mode ?? "instrumental";
  const rawPrompt = body.prompt?.trim();
  const lyrics = body.lyrics?.trim();
  const rawStyle = body.style?.trim();
  const rawTitle = body.title?.trim();

  // Validation: instrumental requires prompt; lyrics mode requires lyrics + style + title.
  if (mode === "instrumental" && !rawPrompt) {
    return NextResponse.json({ error: "prompt is required for instrumental music" }, { status: 400 });
  }
  if (mode === "lyrics" && !lyrics) {
    return NextResponse.json({ error: "lyrics are required for lyric music" }, { status: 400 });
  }
  if (mode === "lyrics" && !rawStyle) {
    return NextResponse.json({ error: "style is required for lyric music" }, { status: 400 });
  }
  if (mode === "lyrics" && !rawTitle) {
    return NextResponse.json({ error: "title is required for lyric music" }, { status: 400 });
  }
  if (!rawStyle) {
    return NextResponse.json({ error: "style is required" }, { status: 400 });
  }
  if (!rawTitle) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  // Clamp to Suno V4_5 custom-mode limits (style ≤ 1000 chars, prompt ≤ 800 chars in practice).
  // We use conservative caps to stay well under undocumented server limits.
  const style = rawStyle.slice(0, 800);
  const title = rawTitle.slice(0, 80);
  const prompt = rawPrompt ? rawPrompt.slice(0, 480) : undefined;

  const durationSeconds = body.durationSeconds ?? 180;
  const model = (process.env.SUNO_MODEL ?? "V4_5") as "V4" | "V4_5" | "V4_5ALL" | "V5" | "V5_5";

  // PRIMARY: Suno
  if (process.env.SUNO_API_KEY) {
    try {
      const result = await sunoGenerateTrack({
        prompt: mode === "lyrics" ? lyrics! : (prompt ?? style),
        instrumental: mode === "instrumental",
        customMode: true,
        style,
        title,
        model,
      });
      const persisted = await persistGeneratedAudio(result.url);
      console.log(`[GEN-MUSIC] url=${persisted.url}`);
      return NextResponse.json({ ...result, url: persisted.url, provider: "suno", stored: persisted.stored });
    } catch (err) {
      console.error("[music] Suno failed, falling back to fal:", err);
    }
  }

  if (mode === "lyrics") {
    return NextResponse.json(
      { error: "Lyric music requires SUNO_API_KEY; fallback provider only supports instrumental tracks" },
      { status: 500 },
    );
  }

  // FALLBACK: fal-ai/elevenlabs/music
  if (!process.env.FAL_KEY) {
    return NextResponse.json(
      { error: "No music provider configured (SUNO_API_KEY and FAL_KEY both missing)" },
      { status: 500 },
    );
  }

  // Clamp to ElevenLabs music model limits: 3,000ms-600,000ms.
  const requestedMs = Math.round(durationSeconds * 1000);
  const music_length_ms = Math.min(600000, Math.max(3000, requestedMs));

  try {
    const result = await fal.subscribe("fal-ai/elevenlabs/music", {
      input: {
        prompt: prompt ?? style,
        force_instrumental: true,
        music_length_ms,
      },
      logs: false,
    });
    const url = (result?.data as unknown as MusicOutput)?.audio?.url;
    if (!url) {
      return NextResponse.json({ error: "no audio url in fal response" }, { status: 502 });
    }
    console.log(`[GEN-MUSIC] url=${url}`);
    const hostedUrl = await rehost(url, "music", "mp3");
    return NextResponse.json({ url: hostedUrl, durationMs: music_length_ms, provider: "fal" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
