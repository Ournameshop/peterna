// POST /api/photo/import — copy a PASTED image link (Google Drive / Dropbox /
// any public image URL) onto durable storage so it survives a save + resume.
//
// Pasted links were previously persisted as-is — they only stay valid while the
// third-party host keeps them shared, so a resumed draft could show a broken
// photo. This route fetches the linked image server-side and re-hosts it to S3
// (falling back to fal.storage, then to the source URL, so nothing ever breaks).
//
// SSRF-hardened: the URL is user-controlled, so we (1) require https, (2) resolve
// every hop's host via DNS and reject any address in a private/loopback/
// link-local/CGNAT range (blocks 169.254.169.254 metadata, internal services),
// (3) follow redirects MANUALLY, re-validating each hop, and (4) enforce an
// image content-type + size cap.
//
// Body: { url: string }   Response: { url, stored } | { error }
import { NextResponse } from "next/server";
import { fal } from "@/lib/fal";
import { store } from "@/lib/server/storage";
import dns from "dns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_HOPS = 5;
const FETCH_TIMEOUT_MS = 30_000;

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

// Reject IPs that could reach internal infrastructure. Covers IPv4 private/
// reserved ranges and the dangerous IPv6 ranges (loopback, ULA, link-local,
// and IPv4-mapped addresses re-checked as IPv4).
function isBlockedIp(ip: string): boolean {
  const v4 = ip.includes(".") ? ip.split(".").map(Number) : null;
  if (v4 && v4.length === 4 && v4.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    const [a, b] = v4;
    if (a === 10) return true;                          // 10.0.0.0/8
    if (a === 127) return true;                         // loopback
    if (a === 0) return true;                           // 0.0.0.0/8
    if (a === 169 && b === 254) return true;            // link-local (incl. cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
    if (a === 192 && b === 168) return true;            // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true;  // CGNAT 100.64.0.0/10
    if (a === 192 && b === 0) return true;              // 192.0.0.0/24 (IETF protocol)
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmark 198.18.0.0/15
    if (a >= 224) return true;                          // multicast/reserved 224+
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;            // loopback / unspecified
  if (lower.startsWith("fe80")) return true;                    // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA fc00::/7
  if (lower.startsWith("ff")) return true;                      // multicast
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — re-check the embedded v4.
  const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIp(mapped[1]);
  return true; // unknown form → fail closed
}

// Validate scheme + resolve host to public IP(s). Throws on anything unsafe.
async function assertPublicHttpsUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("invalid url");
  }
  if (u.protocol !== "https:") throw new Error("only https urls are allowed");
  const host = u.hostname;
  // Numeric host? check directly. Otherwise resolve via DNS (all records).
  const addrs = await dns.promises.lookup(host, { all: true }).catch(() => {
    throw new Error("dns resolution failed");
  });
  if (!addrs.length) throw new Error("host did not resolve");
  for (const { address } of addrs) {
    if (isBlockedIp(address)) throw new Error("host resolves to a private/blocked address");
  }
  return u;
}

// Manual-redirect fetch loop — re-validates every hop so a redirect can't bounce
// us onto an internal address.
async function safeFetchImage(startUrl: string): Promise<Response> {
  let current = startUrl;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    await assertPublicHttpsUrl(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current, {
        signal: controller.signal,
        redirect: "manual",
        headers: { accept: "image/*,*/*;q=0.8" },
      });
    } finally {
      clearTimeout(timer);
    }
    // 3xx with a Location → resolve and loop (re-validated next iteration).
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

export async function POST(req: Request) {
  let body: { url?: string };
  try {
    body = (await req.json()) as { url?: string };
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }
  const src = body.url?.trim();
  if (!src) return NextResponse.json({ error: "url is required" }, { status: 400 });

  try {
    const res = await safeFetchImage(src);
    if (!res.ok) {
      return NextResponse.json({ error: `source returned ${res.status}` }, { status: 502 });
    }
    const contentType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "link is not an image" }, { status: 415 });
    }
    const lenHeader = Number(res.headers.get("content-length") || 0);
    if (lenHeader && lenHeader > MAX_BYTES) {
      return NextResponse.json({ error: "image exceeds 25 MB limit" }, { status: 413 });
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "image exceeds 25 MB limit" }, { status: 413 });
    }
    const ext = EXT_BY_TYPE[contentType] || "png";

    // Durable S3 when configured; else fal.storage; else (both unavailable) the
    // caller keeps the original pasted URL. stored=false signals a soft fallback.
    const s3Url = await store(buffer, contentType, "pet-photo", ext);
    if (s3Url) return NextResponse.json({ url: s3Url, stored: true });

    try {
      const falUrl = await fal.storage.upload(new Blob([buffer], { type: contentType }));
      return NextResponse.json({ url: falUrl, stored: true });
    } catch {
      // No durable target available — tell the client to keep the source URL.
      return NextResponse.json({ url: src, stored: false });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "import failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
