// Gemini API route — keeps GEMINI_API_KEY server-side.
//  mode 'vision' { prompt, imageBase64?|imageUrl? }            -> JSON text
//  mode 'text'   { prompt }                                    -> plain text
//  mode 'image'  { prompt, refImages: [{data,mimeType}|{url}] } -> generated image (base64)
//
// 'image' uses gemini-2.5-flash-image ("Nano Banana") — it conditions on the
// reference images, so the output keeps the SAME pet. This is what the skill's
// `medias[]` reference workflow requires; plain text-to-image cannot do it.
import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { serviceErrorResponse } from '@/lib/server/api-error';

const TEXT_MODEL = 'gemini-2.5-flash';
const IMAGE_MODEL = 'gemini-2.5-flash-image';

interface RefImage {
  data?: string;
  mimeType?: string;
  url?: string;
}
interface GeminiRequest {
  mode?: 'vision' | 'text' | 'image';
  prompt?: string;
  imageBase64?: string;
  imageMimeType?: string;
  imageUrl?: string;
  refImages?: RefImage[];
}

// Resolve a ref to inline base64 bytes — fetches URLs server-side.
async function resolveRef(ref: RefImage): Promise<{ mimeType: string; data: string } | null> {
  if (ref.data) return { mimeType: ref.mimeType || 'image/jpeg', data: ref.data };
  if (ref.url) {
    const res = await fetch(ref.url);
    if (!res.ok) return null;
    return {
      mimeType: res.headers.get('content-type')?.split(';')[0] || 'image/jpeg',
      data: Buffer.from(await res.arrayBuffer()).toString('base64'),
    };
  }
  return null;
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not set' }, { status: 500 });
  }

  let body: GeminiRequest;
  try {
    body = (await req.json()) as GeminiRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { mode, prompt, imageBase64, imageMimeType, imageUrl, refImages } = body;
  if (!prompt) {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    if (mode === 'image') {
      // Reference-conditioned image generation. Reference images come first so
      // the model treats the prompt as an instruction applied to them.
      const refs = await Promise.all((refImages ?? []).map(resolveRef));
      const parts: Array<Record<string, unknown>> = [];
      for (const r of refs) {
        if (r) parts.push({ inlineData: { mimeType: r.mimeType, data: r.data } });
      }
      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: parts,
      });

      const out = response.candidates?.[0]?.content?.parts ?? [];
      const imgPart = out.find((p) => p.inlineData?.data);
      if (!imgPart?.inlineData?.data) {
        return NextResponse.json(
          { error: 'Gemini returned no image', service: 'gemini', text: response.text ?? '' },
          { status: 502 },
        );
      }
      return NextResponse.json({
        image: {
          data: imgPart.inlineData.data,
          mimeType: imgPart.inlineData.mimeType || 'image/png',
        },
      });
    }

    if (mode === 'vision') {
      let data = imageBase64;
      let mimeType = imageMimeType || 'image/jpeg';
      if (!data && imageUrl) {
        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) throw new Error(`Image fetch failed (${imgRes.status})`);
        data = Buffer.from(await imgRes.arrayBuffer()).toString('base64');
        mimeType = imgRes.headers.get('content-type')?.split(';')[0] || mimeType;
      }
      if (!data) {
        return NextResponse.json({ error: 'No image provided' }, { status: 400 });
      }
      const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: [{ inlineData: { mimeType, data } }, { text: prompt }],
        config: { responseMimeType: 'application/json' },
      });
      return NextResponse.json({ text: response.text ?? '' });
    }

    // text mode
    const response = await ai.models.generateContent({ model: TEXT_MODEL, contents: prompt });
    return NextResponse.json({ text: response.text ?? '' });
  } catch (err) {
    return serviceErrorResponse('gemini', err);
  }
}
