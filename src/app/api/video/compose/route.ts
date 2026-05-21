// POST /api/video/compose
// Assembles the full tribute timeline — opening/closing card images, per-beat caption
// card images, beat videos, and an optional audio track — into a single video using
// fal-ai/ffmpeg-api/compose.
//
// Body: {
//   openingCardUrl: string | null,
//   closingCardUrl: string | null,
//   beats: Array<{ index: number, videoUrl?: string, captionCardUrl?: string }>,
//   musicUrl?: string | null,
//   narrationUrl?: string | null,
//   aspectRatio: "9:16" | "16:9" | "1:1",
//   perBeatMs: number,
//   cardMs?: number,        // default 3000 — duration per opening/closing card
//   captionMs?: number,     // default 2500 — duration per caption card image
// }
// Response: { url: string }

import { NextResponse } from "next/server";
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
  perBeatMs?: number;
  cardMs?: number;
  captionMs?: number;
}

interface ComposeOutput {
  video: { url: string };
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

  const perBeatMs = body.perBeatMs ?? 5000;
  const cardMs = body.cardMs ?? 3000;
  const captionMs = body.captionMs ?? 2500;

  // Build video track keyframes — compute absolute timestamp for every segment.
  // This timeline math is intentional: we compute the absolute timestamp for every
  // segment regardless of whether we use a single mixed-keyframe track or separate
  // image/video tracks. If fal-ai/ffmpeg-api/compose rejects mixed image+video
  // keyframes on one track at runtime, the fallback is to emit separate single-keyframe
  // image tracks placed at these same accumulated timestamps alongside a video track.
  //
  // timestamp/duration in ms — confirmed against fal-ai/ffmpeg-api/compose schema.
  interface Keyframe { timestamp: number; duration: number; url: string }
  interface Track { id: string; type: string; keyframes: Keyframe[] }
  const keyframes: Keyframe[] = [];

  let timestamp = 0;

  if (body.openingCardUrl) {
    keyframes.push({ timestamp, duration: cardMs, url: body.openingCardUrl });
    timestamp += cardMs;
  }

  for (const beat of beats) {
    if (beat.captionCardUrl) {
      keyframes.push({ timestamp, duration: captionMs, url: beat.captionCardUrl });
      timestamp += captionMs;
    }
    if (beat.videoUrl) {
      keyframes.push({ timestamp, duration: perBeatMs, url: beat.videoUrl });
      timestamp += perBeatMs;
    }
  }

  if (body.closingCardUrl) {
    keyframes.push({ timestamp, duration: cardMs, url: body.closingCardUrl });
    timestamp += cardMs;
  }

  const totalTimelineMs = timestamp;

  const tracks: Track[] = [
    {
      id: "video_main",
      type: "video",
      keyframes,
    },
  ];

  // Audio: narration XOR music — narration takes priority when both are present.
  // If fal compose truncates audio shorter than the timeline, the music keyframe may
  // need to be repeated to cover totalTimelineMs — split the keyframe at loop points.
  const audioUrl = body.narrationUrl || body.musicUrl || null;
  if (audioUrl) {
    tracks.push({
      id: "audio_main",
      type: "audio",
      keyframes: [{ timestamp: 0, duration: totalTimelineMs, url: audioUrl }],
    });
  }

  try {
    const result = await fal.subscribe("fal-ai/ffmpeg-api/compose", {
      input: {
        tracks,
        aspect_ratio: body.aspectRatio ?? "9:16",
      },
      logs: false,
    });
    const url = (result?.data as ComposeOutput)?.video?.url;
    if (!url) {
      return NextResponse.json({ error: "no video url in fal response" }, { status: 502 });
    }
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
