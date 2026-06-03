// GET /api/download?url=<asset>&name=<filename>
// Same-origin download proxy. The composed video lives on S3 (or fal); the
// <video> player can play it cross-origin, but a browser fetch()->blob() for
// "Download" is blocked unless the bucket has CORS (which our IAM user can't
// set). Streaming it back through our own origin sidesteps CORS entirely and
// lets us force a Content-Disposition: attachment so it downloads with a name.
//
// Not an open proxy: only our S3 bucket (*.amazonaws.com) and fal.media are
// allowed, over https.
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function allowedHost(host: string): boolean {
  const h = host.toLowerCase();
  return h.endsWith(".amazonaws.com") || h === "fal.media" || h.endsWith(".fal.media");
}

export async function GET(req: Request) {
  const reqUrl = new URL(req.url);
  const target = reqUrl.searchParams.get("url");
  const rawName = reqUrl.searchParams.get("name") || "tribute";
  const safeName = rawName.replace(/[^\w.-]+/g, "_").slice(0, 120) || "tribute";

  if (!target) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  if (parsed.protocol !== "https:" || !allowedHost(parsed.hostname)) {
    return NextResponse.json({ error: "host not allowed" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(parsed.toString());
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    // Surface the upstream status so the client's expired-link self-heal can
    // recompose and retry (a 403 here means the source URL expired/vanished).
    return NextResponse.json({ error: `upstream ${upstream.status}` }, { status: 502 });
  }

  const fname = safeName.endsWith(".mp4") ? safeName : `${safeName}.mp4`;
  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") || "video/mp4");
  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  headers.set("Content-Disposition", `attachment; filename="${fname}"`);
  headers.set("Cache-Control", "no-store");

  // Stream the upstream body straight through — no buffering in server memory.
  return new Response(upstream.body, { status: 200, headers });
}
