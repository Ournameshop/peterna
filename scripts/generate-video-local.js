// Local memory-video generator — owner + dog, no server needed.
// Reference photos (owner, dog, or both together) → Seedance 2.0 reference-to-video
// clips per scene → ffmpeg stitch → optional song mix. Mirrors the app's beat
// pipeline (bytedance/seedance-2.0/reference-to-video, muted clips) but runs
// entirely from this machine with FAL_KEY from .env.local.
//
// Usage:
//   node scripts/generate-video-local.js --config .videos/rocky-memories.json
//   node scripts/generate-video-local.js --config <cfg> --fast     (cheaper/quicker Seedance variant)
//   node scripts/generate-video-local.js --config <cfg> --provider atlas   (Atlas Cloud broker,
//       same ByteDance models — needs ATLAS_API_KEY in .env.local; contract mirrored from
//       lifemovie.ai/lib/providers/atlas.ts: uploadMedia → generateVideo → poll prediction)
//
// Config shape (JSON):
// {
//   "name": "rocky-memories",
//   "aspectRatio": "9:16",            // 21:9 16:9 4:3 1:1 3:4 9:16
//   "resolution": "720p",             // 480p | 720p
//   "referenceImages": ["photos/owner.jpg", "photos/rocky-1.jpg"],  // ≤9, local paths or https URLs
//   "audio": ".songs/for-rocky-one-minute/variant-2-trimmed.mp3",   // optional song to lay under
//   "scenes": [
//     { "name": "couch", "duration": 10, "prompt": "The owner and the dog curled up ..." },
//     ...
//   ]
// }
// Output: .videos/<name>/scene-N.mp4 + final.mp4

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { fal } = require('@fal-ai/client');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const hasFlag = (name) => process.argv.includes('--' + name);

// ---- Atlas Cloud provider (mirrors lifemovie.ai/lib/providers/atlas.ts) ----
// Same ByteDance Seedance models as fal, different broker. Upload references
// via multipart uploadMedia (sequential — the link is bandwidth-bound), start
// with generateVideo, poll /model/prediction/{id} until completed.
const ATLAS_BASE = (process.env.ATLAS_BASE_URL || 'https://api.atlascloud.ai/api/v1').replace(/\/$/, '');

function atlasRefModel() {
  const base = (process.env.ATLAS_SEEDANCE_MODEL || 'bytedance/seedance-2.0/image-to-video').trim();
  return base.replace(/\/image-to-video$/, '/reference-to-video');
}

async function atlasUploadImage(localPathOrUrl, label) {
  const key = process.env.ATLAS_API_KEY;
  let bytes, mime, name;
  if (/^https?:\/\//.test(localPathOrUrl)) {
    const r = await fetch(localPathOrUrl);
    if (!r.ok) throw new Error(`fetch ref ${label}: ${r.status}`);
    bytes = Buffer.from(await r.arrayBuffer());
    mime = r.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
    name = `${label}.jpg`;
  } else {
    bytes = fs.readFileSync(localPathOrUrl);
    const ext = path.extname(localPathOrUrl).slice(1).toLowerCase() || 'jpg';
    mime = 'image/' + (ext === 'jpg' ? 'jpeg' : ext);
    name = `${label}.${ext}`;
  }
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(bytes)], { type: mime }), name);
  const res = await fetch(`${ATLAS_BASE}/model/uploadMedia`, {
    method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`atlas uploadMedia ${label}: ${res.status} ${text.slice(0, 200)}`);
  let json = null; try { json = JSON.parse(text); } catch { /* classified below */ }
  const d = json?.data ?? json;
  const url = d?.download_url || d?.url;
  if (!url) throw new Error(`atlas uploadMedia ${label}: no url in ${text.slice(0, 200)}`);
  return url;
}

const ATLAS_TRANSIENT = /still being prepared|please retry|try again|not ready|temporarily unavailable|timeout/i;

async function atlasGenerateClip({ prompt, durationSec, resolution, aspect, referenceUrls }) {
  const key = process.env.ATLAS_API_KEY;
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const body = {
    model: atlasRefModel(),
    prompt: (referenceUrls.length
      ? 'IDENTITY: the attached images are approved reference photos; every person and animal in the clip must match them exactly. ' +
        'The ONLY person in frame is the owner from the references and the ONLY animal is the dog from the references — no other people, no other animals. ' +
        'No text, captions, logos or watermarks. '
      : '') + prompt,
    reference_images: referenceUrls,
    duration: Math.max(4, Math.min(15, Math.round(durationSec))),
    resolution,
    ratio: aspect,
    generate_audio: false,
    bitrate_mode: 'high',
  };
  // Start, retrying while uploaded references finish ingesting server-side.
  let res, text;
  for (let i = 0; i <= 4; i++) {
    res = await fetch(`${ATLAS_BASE}/model/generateVideo`, { method: 'POST', headers, body: JSON.stringify(body) });
    text = await res.text();
    const transient = [502, 503, 504].includes(res.status) || (!res.ok && ATLAS_TRANSIENT.test(text));
    if (!transient || !referenceUrls.length || i === 4) break;
    const wait = 6000 * (i + 1);
    console.warn(`[atlas] start ${res.status} — assets likely ingesting, retry in ${wait / 1000}s`);
    await new Promise((r) => setTimeout(r, wait));
  }
  if (!res.ok) throw new Error(`atlas generateVideo: ${res.status} ${text.slice(0, 400)}`);
  let json = null; try { json = JSON.parse(text); } catch { /* handled below */ }
  const sd = json?.data ?? json;
  const id = sd?.id || sd?.request_id;
  if (!id) throw new Error(`atlas: no prediction id in ${text.slice(0, 200)}`);

  const deadline = Date.now() + 10 * 60_000;
  for (;;) {
    if (Date.now() > deadline) throw new Error(`atlas prediction ${id} timed out`);
    await new Promise((r) => setTimeout(r, 3000));
    const pr = await fetch(`${ATLAS_BASE}/model/prediction/${id}`, { headers });
    const ptext = await pr.text();
    let pjson = null; try { pjson = JSON.parse(ptext); } catch { /* handled below */ }
    const d = pjson?.data ?? pjson;
    const status = String(d?.status || '').toLowerCase();
    if (['failed', 'error', 'canceled', 'cancelled'].includes(status)) {
      const stated = [d?.error, d?.failure_reason, d?.message, pjson?.message].filter(Boolean).join(' ');
      throw new Error(`atlas prediction failed: ${stated || ptext.slice(0, 300)}`);
    }
    if (['completed', 'succeeded', 'success', 'done'].includes(status)) {
      let outputs = Array.isArray(d?.outputs) ? d.outputs : [];
      if (!outputs.length && typeof d?.output === 'string') outputs = [d.output];
      const first = outputs[0];
      const url = typeof first === 'string' ? first : first?.url;
      if (!url) throw new Error('atlas completed but returned no video URL');
      return url;
    }
  }
}

async function main() {
  const provider = arg('provider', 'fal');
  if (provider === 'atlas') {
    if (!process.env.ATLAS_API_KEY) throw new Error('ATLAS_API_KEY not found in .env.local');
  } else {
    if (!process.env.FAL_KEY) throw new Error('FAL_KEY not found in .env.local');
    fal.config({ credentials: process.env.FAL_KEY });
  }

  const cfgPath = arg('config');
  if (!cfgPath) throw new Error('--config <file.json> is required');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const cfgDir = path.dirname(path.resolve(cfgPath));
  const outDir = path.join(cfgDir, cfg.name || 'memory-video');
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Reference photos → provider-hosted URLs. Atlas needs its own uploads
  //    (sequential — its link is bandwidth-bound); fal takes storage.upload.
  const refs = [];
  for (const ref of (cfg.referenceImages || []).slice(0, 9)) {
    if (provider === 'atlas') {
      const p = /^https?:\/\//.test(ref) ? ref : (path.isAbsolute(ref) ? ref : path.join(cfgDir, ref));
      const url = await atlasUploadImage(p, path.basename(String(ref)).replace(/\.[^.]+$/, ''));
      console.log('[ref→atlas]', path.basename(String(ref)), '->', url.slice(0, 60) + '…');
      refs.push(url);
      continue;
    }
    if (/^https?:\/\//.test(ref)) { refs.push(ref); continue; }
    const p = path.isAbsolute(ref) ? ref : path.join(cfgDir, ref);
    const data = fs.readFileSync(p);
    const file = new File([data], path.basename(p), { type: 'image/' + (path.extname(p).slice(1) || 'jpeg') });
    const url = await fal.storage.upload(file);
    console.log('[ref]', path.basename(p), '->', url.slice(0, 60) + '…');
    refs.push(url);
  }
  if (refs.length === 0) throw new Error('referenceImages is required — the likeness comes from these');

  const endpoint = provider === 'atlas'
    ? `atlas:${atlasRefModel()}`
    : `bytedance/seedance-2.0${hasFlag('fast') ? '/fast' : ''}/reference-to-video`;
  console.log(`[gen] ${cfg.scenes.length} scenes via ${endpoint} (${cfg.resolution || '720p'}, ${cfg.aspectRatio || '9:16'})`);

  // 2. Generate every scene concurrently — Seedance takes minutes per clip,
  //    so parallel submission is the whole ballgame for wall-clock time.
  const results = await Promise.all(cfg.scenes.map(async (scene, i) => {
    const t0 = Date.now();
    let url;
    if (provider === 'atlas') {
      url = await atlasGenerateClip({
        prompt: scene.prompt,
        durationSec: scene.duration || 10,
        resolution: cfg.resolution || '720p',
        aspect: cfg.aspectRatio || '9:16',
        referenceUrls: refs,
      });
    } else {
      const input = {
        prompt:
          'IDENTITY: the attached images are approved reference photos; every person and animal in the clip must match them exactly. ' +
          'The ONLY person in frame is the owner from the references and the ONLY animal is the dog from the references — no other people, no other animals. ' +
          'No text, captions, logos or watermarks. ' + scene.prompt,
        duration: String(scene.duration || 10),
        resolution: cfg.resolution || '720p',
        aspect_ratio: cfg.aspectRatio || '9:16',
        generate_audio: false, // the song is the sole audio track
        image_urls: refs,
      };
      const result = await fal.subscribe(endpoint, { input, logs: false });
      url = result?.data?.video?.url;
    }
    if (!url) throw new Error(`scene ${i} (${scene.name}): no video url in provider response`);
    const file = path.join(outDir, `scene-${i + 1}-${(scene.name || '').replace(/[^a-z0-9]+/gi, '-')}.mp4`);
    fs.writeFileSync(file, Buffer.from(await (await fetch(url)).arrayBuffer()));
    console.log(`[clip ${i + 1}/${cfg.scenes.length}] ${path.basename(file)}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    return file;
  }));

  // 3. Stitch with ffmpeg (concat demuxer + re-encode for clean joins).
  const listFile = path.join(outDir, 'concat.txt');
  fs.writeFileSync(listFile, results.map((f) => `file '${path.resolve(f).replace(/\\/g, '/')}'`).join('\n'));
  const final = path.join(outDir, 'final.mp4');
  const vArgs = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile];

  const audio = cfg.audio ? (path.isAbsolute(cfg.audio) ? cfg.audio : path.join(cfgDir, cfg.audio)) : null;
  if (audio && fs.existsSync(audio)) {
    // Probe stitched video length for the end-of-video audio fade.
    const silent = path.join(outDir, 'silent.mp4');
    execFileSync('ffmpeg', [...vArgs, '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-an', silent]);
    const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', silent]).toString());
    const fadeSt = Math.max(0, dur - 2.5);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', audio,
      '-filter_complex', `[1:a]afade=t=out:st=${fadeSt.toFixed(2)}:d=2.5,atrim=0:${dur.toFixed(2)}[a]`,
      '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', final]);
    fs.unlinkSync(silent);
    console.log(`[mix] song laid under video, fade at ${fadeSt.toFixed(1)}s`);
  } else {
    execFileSync('ffmpeg', [...vArgs, '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-an', final]);
    if (cfg.audio) console.warn('[warn] audio file not found:', cfg.audio, '— produced silent video');
  }
  const totalDur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', final]).toString());
  console.log(`[done] ${final}  (${totalDur.toFixed(1)}s)`);
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
