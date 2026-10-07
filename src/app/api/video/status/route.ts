// GET /api/video/status?endpoint=bytedance/seedance-2.0/reference-to-video&requestId=xyz
// Returns status (and result if ready) for a queued Seedance job.

import { NextResponse } from "next/server";
import { fal } from "@/lib/fal";
import { rehost } from "@/lib/server/storage";
import { pollAtlasClip } from "@/lib/server/atlas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint");
  const requestId = url.searchParams.get("requestId");
  if (!endpoint || !requestId) {
    return NextResponse.json(
      { error: "endpoint + requestId query params required" },
      { status: 400 }
    );
  }

  // Atlas-brokered jobs: the beat route returns endpoint "atlas:<model>" and
  // the client echoes it back — poll Atlas's prediction API instead of fal.
  if (endpoint.startsWith("atlas:")) {
    if (!process.env.ATLAS_API_KEY) {
      return NextResponse.json({ error: "ATLAS_API_KEY not configured" }, { status: 500 });
    }
    try {
      const poll = await pollAtlasClip(requestId);
      if (poll.state === "COMPLETED") {
        const beatIndex = url.searchParams.get("beatIndex") ?? requestId;
        // eslint-disable-next-line no-console
        console.log(`[GEN-BEAT] index=${beatIndex} url=${poll.url}`);
        const videoUrl = await rehost(poll.url, "beat", "mp4");
        return NextResponse.json({ status: "COMPLETED", url: videoUrl });
      }
      if (poll.state === "FAILED") {
        // Transient (assets still ingesting) → 502 so the client's retry loop
        // resubmits; terminal → surface the stated reason.
        return NextResponse.json({ error: poll.reason }, { status: 502 });
      }
      return NextResponse.json({ status: "IN_PROGRESS" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  if (!process.env.FAL_KEY) {
    return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 });
  }

  try {
    const status = await fal.queue.status(endpoint, { requestId, logs: false });
    if (status.status === "COMPLETED") {
      const result = await fal.queue.result(endpoint, { requestId });
      let videoUrl = result?.data?.video?.url || null;
      if (videoUrl) {
        const beatIndex = url.searchParams.get("beatIndex") ?? requestId;
        // eslint-disable-next-line no-console
        console.log(`[GEN-BEAT] index=${beatIndex} url=${videoUrl}`);
        // Re-host the finished clip to durable S3 so each cut is saved and
        // doesn't vanish when the fal URL expires (~24h). Graceful: returns the
        // fal URL unchanged if S3 isn't configured.
        videoUrl = await rehost(videoUrl, "beat", "mp4");
      }
      return NextResponse.json({
        status: "COMPLETED",
        url: videoUrl,
      });
    }
    return NextResponse.json({ status: status.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
