// POST /api/video/character-sheet
// Generates the 4 character-sheet reference frames in parallel.
// Body: { petPhotoUrl: string, styleDirective: string, petName?: string }
// Returns: { frames: { view: string, url: string }[] }
//
// Replaces the old Higgsfield Soul Character training step. No training,
// no soul_id — just 4 parallel openai/gpt-image-2/edit calls keyed on
// the user's uploaded photo + a style directive.

import { NextResponse } from "next/server";
import { fal } from "@/lib/fal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // seconds — per spec, must complete < 60s

const VIEWS = [
  {
    id: "front",
    label: "front",
    extra:
      "Three-quarter front view, head turned slightly toward camera, both eyes visible, warm soft lighting.",
  },
  {
    id: "side",
    label: "side",
    extra:
      "Profile side view, full silhouette readable, one eye visible, soft natural lighting.",
  },
  {
    id: "full_body",
    label: "full body",
    extra:
      "Full body shot, standing or sitting, all four legs visible, clean simple background.",
  },
  {
    id: "looking_up",
    label: "looking up",
    extra:
      "Close-up, head tilted gently upward toward the viewer, soft catchlight in the eyes, intimate framing.",
  },
] as const;

interface ReqBody {
  petPhotoUrl?: string;
  styleDirective?: string;
  petName?: string;
}

async function generateFrame(
  petPhotoUrl: string,
  styleDirective: string,
  view: (typeof VIEWS)[number],
  petName: string
) {
  const prompt = [
    `A reference portrait of ${petName}, the same animal as in the source image.`,
    view.extra,
    `Visual style: ${styleDirective}`,
    `The pet's appearance must exactly match the source image — same species, breed silhouette, coloring, markings, eye color, ear shape.`,
    `NO text, NO captions, NO watermarks.`,
  ].join(" ");

  const result = await fal.subscribe("openai/gpt-image-2/edit", {
    input: {
      prompt,
      image_urls: [petPhotoUrl],
      image_size: "square_hd",
      quality: "medium",
      output_format: "png",
      ...(process.env.OPENAI_API_KEY ? { openai_api_key: process.env.OPENAI_API_KEY } : {}),
    },
    logs: false,
  });

  const url = result?.data?.images?.[0]?.url;
  if (!url) throw new Error(`no url returned for view=${view.id}`);
  return { view: view.id, url };
}

export async function POST(req: Request) {
  if (!process.env.FAL_KEY) {
    return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 });
  }
  // OPENAI_API_KEY is optional — fal proxies openai/gpt-image-2/edit with FAL_KEY alone.

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const petPhotoUrl = (body.petPhotoUrl || "").trim();
  const styleDirective = (body.styleDirective || "").trim();
  const petName = (body.petName || "your pet").trim();
  if (!petPhotoUrl) {
    return NextResponse.json({ error: "petPhotoUrl required" }, { status: 400 });
  }
  if (!styleDirective) {
    return NextResponse.json(
      { error: "styleDirective required" },
      { status: 400 }
    );
  }

  try {
    const frames = await Promise.all(
      VIEWS.map((v) => generateFrame(petPhotoUrl, styleDirective, v, petName))
    );
    return NextResponse.json({ frames });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
