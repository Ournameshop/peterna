// GET /api/download?url=<asset>&name=<filename>
// Same-origin download proxy. The composed video lives on S3 (or fal); the
// <video> player can play it cross-origin, but a browser fetch()->blob() for
// "Download" is blocked unless the bucket has CORS (which our IAM user can't
// set). Streaming it back through our own origin sidesteps CORS entirely and
// lets us force a Content-Disposition: attachment so it downloads with a name.
//
// Not an open proxy: only OUR specific S3 bucket and fal.media are allowed, over
// https — and every redirect hop is re-validated against the same allowlist so a
// 3xx from an allowed host can't bounce the fetch onto an internal address.
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_HOPS = 4;

// Bound to the exact bucket (not the whole amazonaws.com TLD). Region-flexible
// only so an S3 region-correction redirect (still {bucket}.s3.<region>.amazonaws.com)
// is tolerated; the bucket name is always pinned.
function allowedHost(host: string): boolean {
  const h = host.toLowerCase();
  const bucket = (process.env.S3_BUCKET || "").toLowerCase();
  if (bucket) {
    if (h === `${bucket}.s3.amazonaws.com`) return true;
    if (h.startsWith(`${bucket}.s3.`) && h.endsWith(".amazonaws.com")) return true;
  }
  if (h === "fal.media" || h.endsWith(".fal.media")) return true;
  return false;
}

function assertAllowed(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("invalid url");
  }
  if (u.protocol !== "https:") throw new Error("only https is allowed");
  if (!allowedHost(u.hostname)) throw new Error("host not allowed");
  return u;
}

// Manual-redirect fetch: re-validates every hop so an allowed origin can't
// redirect us onto an internal/unlisted host (SSRF).
async function fetchAllowed(startUrl: string): Promise<Response> {
  let current = startUrl;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    assertAllowed(current);
    const res = await fetch(current, { redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("redirect without location");
      current = new URL(loc, current).toString();
      continue;
    }
    return res;
  }
  throw new Error("too many redirects");
}

export async function GET(req: Request) {
  const reqUrl = new URL(req.url);
  const target = reqUrl.searchParams.get("url");
  const rawName = reqUrl.searchParams.get("name") || "tribute";
  const safeName = rawName.replace(/[^\w.-]+/g, "_").slice(0, 120) || "tribute";

  if (!target) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  try {
    assertAllowed(target);
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid url";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetchAllowed(target);
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
