// Local Suno song generation — runs on a dev machine, no server needed.
// Mirrors src/lib/suno.ts's API contract (sunoapi.org, custom mode, poll
// record-info) but downloads EVERY variant locally with metadata, so a track
// can be hand-picked and wired into a build manually (see scripts/wire-music.js).
//
// Usage:
//   node scripts/generate-song-local.js --title "For Rocky" \
//     --style "warm fingerpicked folk ballad, male vocal" \
//     --lyrics lyrics/rocky.txt [--instrumental] [--model V4_5] [--out .songs]
//
// Reads SUNO_API_KEY from .env.local. Output: <out>/<slug>/variant-N.mp3 + meta.json

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const SUNO_BASE = 'https://api.sunoapi.org';
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 300000;

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const hasFlag = (name) => process.argv.includes('--' + name);

async function main() {
  const key = process.env.SUNO_API_KEY;
  if (!key) throw new Error('SUNO_API_KEY not found in .env.local');

  const title = arg('title');
  const style = arg('style');
  const lyricsFile = arg('lyrics');
  const instrumental = hasFlag('instrumental');
  const model = arg('model', process.env.SUNO_MODEL || 'V4_5');
  const outRoot = arg('out', '.songs');

  if (!title || !style) throw new Error('--title and --style are required');
  if (!instrumental && !lyricsFile) throw new Error('--lyrics <file> is required unless --instrumental');

  const prompt = instrumental
    ? arg('prompt', style)
    : fs.readFileSync(lyricsFile, 'utf8').trim();

  const payload = {
    prompt,
    instrumental,
    customMode: true,
    style,
    title,
    model,
    callBackUrl: 'https://placeholder.invalid/noop', // required by API; we poll instead
  };

  console.log(`[gen] submitting "${title}" (${instrumental ? 'instrumental' : 'lyrics'}, ${model})…`);
  const genRes = await fetch(`${SUNO_BASE}/api/v1/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!genRes.ok) throw new Error(`generate failed: ${genRes.status} ${await genRes.text().catch(() => '')}`);
  const genData = await genRes.json();
  if (genData.code !== 200 || !genData.data?.taskId) throw new Error(`generate error: ${genData.msg}`);
  const { taskId } = genData.data;
  console.log('[gen] taskId:', taskId);

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let tracks = null;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    let poll = null;
    try {
      const res = await fetch(`${SUNO_BASE}/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) poll = await res.json();
    } catch { /* transient network — keep polling */ }
    if (!poll || poll.code !== 200) continue;
    const status = poll.data?.status;
    process.stdout.write(`[gen] status: ${status}        \r`);
    if (status === 'CREATE_TASK_FAILED' || status === 'GENERATE_AUDIO_FAILED' || status === 'SENSITIVE_WORD_ERROR') {
      throw new Error(`generation failed: ${status}`);
    }
    // CALLBACK_EXCEPTION = success whose webhook (our placeholder) failed — audio is ready.
    if (status === 'SUCCESS' || status === 'CALLBACK_EXCEPTION') {
      tracks = (poll.data?.response?.sunoData || []).filter((t) => t && t.audioUrl);
      break;
    }
  }
  if (!tracks) throw new Error('generation timed out');
  console.log(`\n[gen] done — ${tracks.length} variant(s)`);

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const outDir = path.join(outRoot, slug);
  fs.mkdirSync(outDir, { recursive: true });

  const meta = { title, style, model, instrumental, taskId, generatedAt: new Date().toISOString(), variants: [] };
  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i];
    const file = path.join(outDir, `variant-${i + 1}.mp3`);
    const buf = Buffer.from(await (await fetch(t.audioUrl)).arrayBuffer());
    fs.writeFileSync(file, buf);

    // Word-level timing → the exact second singing ends (safe fade point).
    let vocalEndSec = null;
    if (!instrumental && t.id) {
      try {
        const res = await fetch(`${SUNO_BASE}/api/v1/generate/get-timestamped-lyrics`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId, audioId: t.id }),
        });
        const data = await res.json();
        for (const w of data.data?.alignedWords || []) {
          if (w && Number.isFinite(w.endS) && w.word && w.word.trim()) vocalEndSec = Math.max(vocalEndSec ?? 0, w.endS);
        }
      } catch { /* timing is a nice-to-have */ }
    }

    meta.variants.push({
      file: path.basename(file),
      audioId: t.id ?? null,
      sourceUrl: t.audioUrl,
      durationMs: Math.round((Number(t.duration) || 0) * 1000),
      vocalEndSec,
      sizeBytes: buf.length,
    });
    console.log(`[dl] ${file}  ${(buf.length / 1e6).toFixed(1)}MB  ${Math.round(Number(t.duration) || 0)}s  vocalEnd=${vocalEndSec ?? 'n/a'}`);
  }
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));
  console.log('[done]', path.join(outDir, 'meta.json'));
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
