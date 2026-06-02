// POST /api/card/render
// Rasterizes a card SVG to PNG deterministically using @resvg/resvg-wasm,
// then returns the PNG as a data URL { url: "data:image/png;base64,..." }.
//
// Body: { cardType, text, containerId, artStyle, aspectRatio }
// Response: { url: string }

import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import { renderCardSvg, FRAME_DIMS } from "@/lib/peternal-card-spec";
import type { ContainerId, ArtStyleId } from "@/lib/peternal-card-spec";
import { fal } from "@/lib/fal";
import { store } from "@/lib/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Initialize WASM once per process — initWasm throws if called more than once.
let wasmReady: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    const wasm = fs.readFileSync(
      path.join(process.cwd(), "node_modules/@resvg/resvg-wasm/index_bg.wasm"),
    );
    wasmReady = initWasm(wasm);
  }
  return wasmReady;
}

// Read font files once at module scope as Buffers (WASM needs fontBuffers, not fontFiles).
const fontsDir = path.join(process.cwd(), "public", "fonts");
const fontBuffers: Uint8Array[] = [
  "CormorantGaramond-Italic.ttf",
  "Inter-Regular.ttf",
  "Inter-Medium.ttf",
  "JetBrainsMono-Regular.ttf",
].map((f) => fs.readFileSync(path.join(fontsDir, f)));

interface ReqBody {
  cardType?: string;
  text?: string;
  containerId?: string;
  artStyle?: string;
  aspectRatio?: string;
  backgroundImageUrl?: string;
}

const VALID_CARD_TYPES = new Set(["opening", "closing", "caption", "caption_overlay"]);
const VALID_ASPECTS = new Set(["9:16", "16:9", "1:1"]);

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

  const cardType = body.cardType ?? "";
  const text = (body.text ?? "").trim();
  const containerId = (body.containerId ?? "cinematic_lower_third") as ContainerId;
  const artStyle = (body.artStyle ?? "cinematic_realism") as ArtStyleId;
  const aspectRatio = (body.aspectRatio ?? "9:16") as "9:16" | "16:9" | "1:1";
  const backgroundImageUrl = body.backgroundImageUrl;

  if (!VALID_CARD_TYPES.has(cardType)) {
    return NextResponse.json(
      { error: "cardType must be one of: opening, closing, caption, caption_overlay" },
      { status: 400 }
    );
  }
  if (!text) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  if (!VALID_ASPECTS.has(aspectRatio)) {
    return NextResponse.json({ error: "aspectRatio must be 9:16, 16:9, or 1:1" }, { status: 400 });
  }

  // Fetch background image server-side and encode as data URI.
  // Failures are non-fatal — fall back to gradient.
  let backgroundImageHref: string | undefined;
  if (backgroundImageUrl && cardType !== "caption_overlay") {
    try {
      const imgRes = await fetch(backgroundImageUrl);
      if (imgRes.ok) {
        const buf = await imgRes.arrayBuffer();
        const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
        const b64 = Buffer.from(buf).toString("base64");
        backgroundImageHref = `data:${contentType};base64,${b64}`;
      }
    } catch (e) {
      console.warn("[card/render] background image fetch failed:", e);
    }
  }

  try {
    await ensureWasm();

    const svg = renderCardSvg({
      cardType: cardType as "opening" | "closing" | "caption" | "caption_overlay",
      text,
      containerId,
      artStyle,
      aspectRatio,
      backgroundImageHref,
    });

    const { w } = FRAME_DIMS[aspectRatio];

    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: w },
      font: { fontBuffers, loadSystemFonts: false },
    });

    const pngData = resvg.render().asPng();
    const pngArrayBuffer = pngData.buffer.slice(pngData.byteOffset, pngData.byteOffset + pngData.byteLength) as ArrayBuffer;
    const url =
      (await store(Buffer.from(pngArrayBuffer), "image/png", "card", "png")) ??
      (await fal.storage.upload(new Blob([pngArrayBuffer], { type: "image/png" })));

    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "render failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
