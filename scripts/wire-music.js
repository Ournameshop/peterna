// One-off: attach an already-generated (S3-hosted) music track to a build's
// saved state so it persists and is reused — no regeneration. Run on the box
// from the app dir so @prisma/client + DATABASE_URL resolve.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const id = process.argv[2];
const url = process.argv[3];
const durationMs = parseInt(process.argv[4] || '0', 10) || null;

(async () => {
  const b = await prisma.build.findUnique({ where: { id } });
  if (!b) { console.error('build not found:', id); process.exit(1); }
  const s = (b.state && typeof b.state === 'object') ? b.state : {};
  s.musicBedUrl = url;
  s.musicBedDurationMs = durationMs;
  s.assembledVideoUrl = null; // force a fresh compose that includes the music
  s.words = Object.assign({}, s.words, { musicApproved: true });
  await prisma.build.update({ where: { id }, data: { state: s, petName: b.petName ?? null } });
  console.log('wired music into build', id);
  console.log('  musicBedUrl     =', url);
  console.log('  musicBedDurationMs =', durationMs);
})().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
