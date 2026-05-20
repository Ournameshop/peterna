// GET /api/video/status?endpoint=bytedance/seedance-2.0/reference-to-video&requestId=xyz
// Returns status (and result if ready) for a queued Seedance job.

import { NextResponse } from "next/server";
import { fal } from "@/lib/fal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!process.env.FAL_KEY) {
    return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 });
  }
  const url = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint");
  const requestId = url.searchParams.get("requestId");
  if (!endpoint || !requestId) {
    return NextResponse.json(
      { error: "endpoint + requestId query params required" },
      { status: 400 }
    );
  }

  try {
    const status = await fal.queue.status(endpoint, { requestId, logs: false });
    if (status.status === "COMPLETED") {
      const result = await fal.queue.result(endpoint, { requestId });
      return NextResponse.json({
        status: "COMPLETED",
        url: result?.data?.video?.url || null,
      });
    }
    return NextResponse.json({ status: status.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
