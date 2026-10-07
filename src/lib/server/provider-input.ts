// server-only — make asset URLs usable as *inputs* to fal.
//
// In local-disk storage mode (see storage.ts) our durable asset URLs point at
// this machine (http://localhost:3000/local-assets/...). fal's workers cannot
// fetch those, so before handing a local asset to fal as a reference we read
// the bytes off disk and push them to fal storage, which returns a URL fal can
// read. data: URIs (the dev fallback when no storage is configured) get the
// same treatment. Anything else (fal.media, S3) passes through untouched.
//
// Results are cached per URL for the life of the process: the same reference
// sheets ride along on every beat of a 12-beat run.

import { promises as fs } from "fs";
import { fal } from "@/lib/fal";
import { localAssetPath, contentTypeForExt } from "./storage";

const cache = new Map<string, { url: string; at: number }>();
const CACHE_TTL_MS = 45 * 60 * 1000;

async function uploadBytes(bytes: Buffer, mime: string): Promise<string> {
  const blob = new Blob([new Uint8Array(bytes)], { type: mime });
  return await fal.storage.upload(blob);
}

/** Resolve one URL to something fal can fetch. */
export async function toFalInputUrl(url: string): Promise<string> {
  if (!url) return url;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.url;

  let resolved = url;
  if (url.startsWith("data:")) {
    const m = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) throw new Error("malformed data URI");
    resolved = await uploadBytes(Buffer.from(m[2], "base64"), m[1]);
  } else {
    const p = localAssetPath(url);
    if (p) {
      const ext = p.split(".").pop() ?? "";
      resolved = await uploadBytes(await fs.readFile(p), contentTypeForExt(ext));
    }
  }
  if (resolved !== url) cache.set(url, { url: resolved, at: Date.now() });
  return resolved;
}

/** Resolve a list, preserving order; empty/undefined stays as is. */
export async function toFalInputUrls(urls: string[] | undefined): Promise<string[] | undefined> {
  if (!urls?.length) return urls;
  return await Promise.all(urls.map(toFalInputUrl));
}
