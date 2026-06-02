// One-off: re-attach an already-generated (S3-hosted) music track to a build's
// saved state so it persists and is reused — no regeneration. Restores BOTH the
// final-video link (musicBedUrl) AND the step UI (words.musicVariants + ready
// status), matching the shape TheWords sets after a successful generation.
// Run on the box from the app dir (NODE_PATH=.../node_modules) so deps + DATABASE_URL resolve.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const id = process.argv[2];
const url = process.argv[3];
const durationMs = parseInt(process.argv[4] || '0', 10) || null;

(async () => {
  const b = await prisma.build.findUnique({ where: { id } });
  if (!b) { console.error('build not found:', id); process.exit(1); }
  const s = (b.state && typeof b.state === 'object') ? b.state : {};
  const w = (s.words && typeof s.words === 'object') ? s.words : {};
  const title = w.musicTitle || 'Tribute song';

  // Final video uses this.
  s.musicBedUrl = url;
  s.musicBedDurationMs = durationMs;
  s.assembledVideoUrl = null; // force a fresh compose that includes the music

  // Step UI reads these — restore the generated track as a variant.
  s.words = Object.assign({}, w, {
    musicVariants: [{ url, durationMs: durationMs || 0, title }],
    musicGenerationStatus: 'ready',
    musicProvider: w.musicProvider || 'suno',
    musicApproved: true,
  });

  await prisma.build.update({ where: { id }, data: { state: s, petName: b.petName ?? null } });
  console.log('wired music into build', id);
  console.log('  musicBedUrl        =', url);
  console.log('  musicBedDurationMs =', durationMs);
  console.log('  variant title      =', title);
})().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
