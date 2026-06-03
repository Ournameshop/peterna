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
import { sunoGenerateTrack, sunoGetTimestampedLyrics } from "@/lib/suno";
import { describeError, serviceErrorResponse } from "@/lib/server/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 400; // Suno polling can take up to 6 min (V5 + one retry)

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
  const model = (process.env.SUNO_MODEL ?? "V5") as "V4" | "V4_5" | "V4_5ALL" | "V5" | "V5_5";

  // PRIMARY: Suno
  let sunoError: unknown = null;
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

      // For lyric songs, fetch word-level timing so the compositor knows exactly
      // when singing ends. This lets us trim/fade only the instrumental tail —
      // never a lyric. Best-effort: on any failure we omit vocalEndSec and the
      // client falls back to duration-based timing.
      let vocalEndSec: number | null = null;
      if (mode === "lyrics" && result.taskId && result.audioId) {
        try {
          const aligned = await sunoGetTimestampedLyrics(result.taskId, result.audioId);
          if (aligned.vocalEndSec > 0) vocalEndSec = aligned.vocalEndSec;
          console.log(`[GEN-MUSIC] vocalEndSec=${vocalEndSec}`);
        } catch (err) {
          console.warn("[music] timestamped-lyrics fetch failed; using duration-based timing:", err);
        }
      }

      console.log(`[GEN-MUSIC] url=${persisted.url}`);
      return NextResponse.json({
        url: persisted.url,
        durationMs: result.durationMs,
        title: result.title,
        provider: "suno",
        stored: persisted.stored,
        vocalEndSec,
      });
    } catch (err) {
      sunoError = err;
      console.error(`[suno] music generation failed, falling back to fal: ${describeError(err)}`, err);
    }
  }

  // Lyric vocals can ONLY come from Suno — the fal fallback is instrumental-only.
  // Tell the user what actually went wrong instead of always blaming the key.
  if (mode === "lyrics") {
    if (sunoError) {
      return NextResponse.json(
        {
          error: `Music generation failed: ${describeError(sunoError)}. Lyric vocals require Suno; the instrumental fallback can't sing words. Please try again.`,
          service: "suno",
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error: "Lyric music requires Suno, which isn't configured (SUNO_API_KEY missing). The fallback provider only makes instrumental tracks.",
        service: "suno",
      },
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
      return NextResponse.json({ error: "fal returned no audio url", service: "fal" }, { status: 502 });
    }
    console.log(`[GEN-MUSIC] url=${url}`);
    const hostedUrl = await rehost(url, "music", "mp3");
    return NextResponse.json({ url: hostedUrl, durationMs: music_length_ms, provider: "fal" });
  } catch (err) {
    return serviceErrorResponse("fal", err);
  }
}
