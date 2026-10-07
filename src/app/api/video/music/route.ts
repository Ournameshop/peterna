// POST /api/video/music
// Generates an approved music track for the tribute.
// PRIMARY: Suno (sunoapi.org) for instrumental and lyric tracks.
// FALLBACK: fal-ai/elevenlabs/music for instrumental tracks only.
//
// Body: { prompt?: string, lyrics?: string, style?: string, title?: string, mode?: "instrumental"|"lyrics", durationSeconds?: number }
// Response: { url: string, durationMs: number, provider: "suno"|"fal", title?: string, stored?: boolean }

import { NextResponse } from "next/server";
import { fal, describeFalError } from "@/lib/fal";
import { store, rehost } from "@/lib/server/storage";
import { sunoGenerateTrack, sunoGenerateTrackAll, sunoGetTimestampedLyrics } from "@/lib/suno";
import { planLyricFit, pickBestFit } from "@/lib/peternal-lyric-align";
import type { AlignedWordLite, LyricFitReport } from "@/lib/peternal-lyric-align";
import type { SunoGeneratedTrackItem } from "@/lib/suno";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Suno polling can take up to ~3 min

interface AlignRequest {
  videoSeconds: number;
  cardLeadSec: number;
  lyricLines: string[];
}

interface ReqBody {
  mode?: "instrumental" | "lyrics";
  prompt?: string;
  lyrics?: string;
  style?: string;
  title?: string;
  durationSeconds?: number;
  align?: AlignRequest;
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
      if (mode === "lyrics") {
        // Suno always returns 2 variants per generation — fetch both so we can
        // pick whichever one actually lines up with the fixed beat grid.
        const all = await sunoGenerateTrackAll({
          prompt: lyrics!,
          instrumental: false,
          customMode: true,
          style,
          title,
          model,
        });
        const candidates = all.tracks.slice(0, 2);

        let chosen: SunoGeneratedTrackItem = candidates[0];
        let chosenVocalEndSec: number | null = null;
        let alignment: {
          trimSec: number;
          cardExtraMs: number;
          meanAbsErrorSec: number;
          matchedLines: number;
          totalLines: number;
          tailClipped: boolean;
        } | null = null;

        if (body.align) {
          const fits: { track: SunoGeneratedTrackItem; fit: LyricFitReport; vocalEndSec: number }[] = [];
          for (const track of candidates) {
            if (!track.audioId) continue;
            try {
              const aligned = await sunoGetTimestampedLyrics(all.taskId, track.audioId);
              const words: AlignedWordLite[] = aligned.words
                .filter((w) => w.word && w.word.trim().length > 0)
                .map((w) => ({ word: w.word, startS: w.startS, endS: w.endS }));
              const fit = planLyricFit(words, body.align.lyricLines, {
                videoSeconds: body.align.videoSeconds,
                cardLeadSec: body.align.cardLeadSec,
              });
              fits.push({ track, fit, vocalEndSec: aligned.vocalEndSec });
            } catch (err) {
              console.warn("[music] timestamped-lyrics fetch failed for a variant; skipping:", err);
            }
          }
          if (fits.length > 0) {
            const bestIdx = pickBestFit(fits.map((f) => f.fit));
            chosen = fits[bestIdx].track;
            chosenVocalEndSec = fits[bestIdx].vocalEndSec;
            alignment = {
              trimSec: fits[bestIdx].fit.trimSec,
              cardExtraMs: fits[bestIdx].fit.cardExtraMs,
              meanAbsErrorSec: fits[bestIdx].fit.meanAbsErrorSec,
              matchedLines: fits[bestIdx].fit.matchedLines,
              totalLines: fits[bestIdx].fit.totalLines,
              tailClipped: fits[bestIdx].fit.tailClipped,
            };
          }
          // else: no variant was scorable — fall through and behave as today
          // with the first track (chosen/alignment stay at their defaults).
        }

        const persisted = await persistGeneratedAudio(chosen.url);

        // Reuse the vocalEndSec already fetched while scoring; otherwise fetch
        // it fresh for the chosen (first) track, same as today. Best-effort: on
        // any failure we omit vocalEndSec and the client falls back to
        // duration-based timing.
        let vocalEndSec: number | null = chosenVocalEndSec;
        if (vocalEndSec === null && chosen.audioId) {
          try {
            const aligned = await sunoGetTimestampedLyrics(all.taskId, chosen.audioId);
            if (aligned.vocalEndSec > 0) vocalEndSec = aligned.vocalEndSec;
            console.log(`[GEN-MUSIC] vocalEndSec=${vocalEndSec}`);
          } catch (err) {
            console.warn("[music] timestamped-lyrics fetch failed; using duration-based timing:", err);
          }
        }
        // vocalEndSec must be the CHOSEN variant's, minus trimSec (clamped >=0)
        // — the client uses it for duration locking against the TRIMMED track.
        if (vocalEndSec !== null && alignment) {
          vocalEndSec = Math.max(0, vocalEndSec - alignment.trimSec);
        }

        console.log(`[GEN-MUSIC] url=${persisted.url}`);
        return NextResponse.json({
          url: persisted.url,
          durationMs: chosen.durationMs,
          title: chosen.title,
          provider: "suno",
          stored: persisted.stored,
          vocalEndSec,
          ...(alignment ? { alignment } : {}),
        });
      }

      const result = await sunoGenerateTrack({
        prompt: prompt ?? style,
        instrumental: true,
        customMode: true,
        style,
        title,
        model,
      });
      const persisted = await persistGeneratedAudio(result.url);

      console.log(`[GEN-MUSIC] url=${persisted.url}`);
      return NextResponse.json({
        url: persisted.url,
        durationMs: result.durationMs,
        title: result.title,
        provider: "suno",
        stored: persisted.stored,
        vocalEndSec: null,
      });
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
    const { message, status } = describeFalError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
