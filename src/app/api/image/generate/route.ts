// POST /api/image/generate
// Text-to-image via fal.ai openai/gpt-image-2.

import { NextResponse } from "next/server";
import { fal } from "@/lib/fal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImageSize =
  | "landscape_4_3"
  | "square_hd"
  | "landscape_16_9"
  | "portrait_4_3"
  | "portrait_16_9";

interface ReqBody {
  prompt?: string;
  quality?: "low" | "medium" | "high";
  aspect?: ImageSize;
  outputFormat?: "png" | "jpeg" | "webp";
}

export async function POST(req: Request) {
  if (!process.env.FAL_KEY) {
    return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 });
  }
  // OPENAI_API_KEY is optional — fal proxies openai/gpt-image-2 with FAL_KEY alone.

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const prompt = (body.prompt || "").trim();
  if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });

  try {
    const result = await fal.subscribe("openai/gpt-image-2", {
      input: {
        prompt,
        image_size: body.aspect || "landscape_4_3",
        quality: body.quality || "medium",
        num_images: 1,
        output_format: body.outputFormat || "png",
        ...(process.env.OPENAI_API_KEY ? { openai_api_key: process.env.OPENAI_API_KEY } : {}),
      },
      logs: false,
    });
    const url = result?.data?.images?.[0]?.url;
    if (!url) return NextResponse.json({ error: "no image url" }, { status: 502 });
    return NextResponse.json({ url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
