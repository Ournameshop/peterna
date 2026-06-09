// POST /api/image/grid
// Composites 2–4 background-removed pet cutouts into a 2×2 512×512 grid PNG
// using ffmpeg (no new deps). Returns { url } pointing at the S3-stored PNG, or
// { url: null } when S3 is not configured so callers fall back to characterSheetUrl.
//
// FEATURE FLAG: disabled unless BOTH flags are set:
//   NEXT_PUBLIC_OWN_REFERENCE_SHEET=1  (build-time, gates the client UI)
//   OWN_REFERENCE_SHEET_API=1          (server-only runtime, gates this route)
// SSRF guard: only accepts https URLs whose host matches *.s3.*.amazonaws.com or *.fal.media.
//
// Body: { imageUrls: string[] }  — exactly 4 URLs (caller normalizes count).
// Response: { url: string | null }

import { NextResponse } from "next/server";
import os from "os";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { store } from "@/lib/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAllowedHost(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  // Allow fal.media (short-lived fal outputs before re-hosting)
  if (host === "fal.media" || host.endsWith(".fal.media")) return true;
  // Allow *.s3.*.amazonaws.com (covers all real S3 URLs this codebase generates)
  if (/\.s3\.[^.]+\.amazonaws\.com$/.test(host)) return true;
  return false;
}

async function downloadToTmp(url: string, filename: string): Promise<string> {
  const dest = path.join(os.tmpdir(), filename);
  // redirect: 'manual' prevents a whitelisted host from 302-bouncing to an internal address.
  const res = await fetch(url, { redirect: 'manual' });
  if (!res.ok || res.type === 'opaqueredirect') throw new Error(`download failed: ${url} (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return dest;
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: "pipe" });
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-600)}`));
    });
    proc.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new Error("ffmpeg not available on server"));
      } else {
        reject(new Error(`ffmpeg spawn failed: ${err.message}`));
      }
    });
  });
}

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_OWN_REFERENCE_SHEET !== "1" || process.env.OWN_REFERENCE_SHEET_API !== "1") {
    return NextResponse.json({ error: "feature disabled" }, { status: 404 });
  }

  let body: { imageUrls?: unknown };
  try {
    body = (await req.json()) as { imageUrls?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const imageUrls = Array.isArray(body.imageUrls)
    ? (body.imageUrls as unknown[]).filter((u): u is string => typeof u === "string" && u.length > 0)
    : [];

  if (imageUrls.length !== 4) {
    return NextResponse.json({ error: "exactly 4 imageUrls required" }, { status: 400 });
  }

  for (const u of imageUrls) {
    if (!isAllowedHost(u)) {
      return NextResponse.json({ error: `disallowed URL host: ${u}` }, { status: 400 });
    }
  }

  const now = Date.now();
  const tmpFiles: string[] = [];
  const outPath = path.join(os.tmpdir(), `grid_out_${now}.png`);

  try {
    const localPaths: string[] = [];
    for (let i = 0; i < 4; i++) {
      const p = await downloadToTmp(imageUrls[i], `grid_in_${now}_${i}.png`);
      tmpFiles.push(p);
      localPaths.push(p);
    }

    // Build ffmpeg xstack 2×2 grid.
    // Each input: scale to 512×512 (letterbox), pad to 512×512 on white.
    // xstack layout: TL=0_0, TR=w0_0, BL=0_h0, BR=w0_h0.
    const filterParts: string[] = [];
    for (let i = 0; i < 4; i++) {
      filterParts.push(
        `[${i}:v]scale=512:512:force_original_aspect_ratio=decrease,` +
        `pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white[p${i}]`
      );
    }
    filterParts.push(`[p0][p1][p2][p3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0[grid]`);

    const args = [
      "-y",
      "-i", localPaths[0],
      "-i", localPaths[1],
      "-i", localPaths[2],
      "-i", localPaths[3],
      "-filter_complex", filterParts.join(";"),
      "-map", "[grid]",
      "-frames:v", "1",
      outPath,
    ];

    await runFfmpeg(args);
    tmpFiles.push(outPath);

    const buffer = fs.readFileSync(outPath);
    const url = await store(buffer, "image/png", "grid", "png");
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    for (const p of tmpFiles) {
      try { fs.unlinkSync(p); } catch { /* best-effort */ }
    }
  }
}
