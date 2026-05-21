// POST /api/video/assemble
// Concatenates beat video URLs into a single MP4 using fal-ai/ffmpeg-api/merge-videos.
//
// Body: { videoUrls: string[] }
// Response: { url: string }

import { NextResponse } from "next/server";
import { fal } from "@/lib/fal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface ReqBody {
  videoUrls?: string[];
}

interface MergeVideosOutput {
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

  const videoUrls = body.videoUrls;
  if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
    return NextResponse.json({ error: "videoUrls must be a non-empty array" }, { status: 400 });
  }

  try {
    const result = await fal.subscribe("fal-ai/ffmpeg-api/merge-videos", {
      input: { video_urls: videoUrls },
      logs: false,
    });
    const url = (result?.data as MergeVideosOutput)?.video?.url;
    if (!url) {
      return NextResponse.json({ error: "no video url in fal response" }, { status: 502 });
    }
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
