// One-off recovery: restore build cmpx22e9t to its finished state using assets
// already generated (paid for), so opening it does NOT regenerate anything.
// - beatVideos populated (Generate skips re-render when count >= beatCount)
// - assembledVideoUrl = the finished S3 master (durable)
// - generationComplete = true, stepIndex = finished
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const id = 'cmpx22e9t0001nz99zg45tv7q';
const FINISHED_STEP = 24;
const master = 'https://peterna-tribute-assets-dev.s3.us-east-1.amazonaws.com/peterna/assets/master/2967aa93-29dd-45b0-a77e-9cb47071e3ad.mp4';
const beatVideos = {
  0: 'https://v3b.fal.media/files/b/0a9cba5a/1LhCQlHhtQdAVTh7XcY61_video.mp4',
  1: 'https://v3b.fal.media/files/b/0a9cba5c/V4D_s_eTvhNB73gcKizTn_video.mp4',
  2: 'https://v3b.fal.media/files/b/0a9cba55/cykUS5GVt8HXgeBt9U7ff_video.mp4',
  3: 'https://v3b.fal.media/files/b/0a9cba66/6dcr5NXa_h2_y8FCiLcJz_video.mp4',
  4: 'https://v3b.fal.media/files/b/0a9cba67/osY2ChR3yXCCRcmg_DkZp_video.mp4',
  5: 'https://v3b.fal.media/files/b/0a9cba69/KQLr5yzlveLw7Kxv8N7o4_video.mp4',
  6: 'https://v3b.fal.media/files/b/0a9cba7a/G4c8LmC1LJAmGVXgbzOCK_video.mp4',
  7: 'https://v3b.fal.media/files/b/0a9cba75/ILsnI8hc8q2CFsQ90QA61_video.mp4',
  8: 'https://v3b.fal.media/files/b/0a9cba79/ZP6mK276GCf6yDbhUL1AC_video.mp4',
  9: 'https://v3b.fal.media/files/b/0a9cba8a/U4c3YX4eTIj86MAZf1nZ7_video.mp4',
  10: 'https://v3b.fal.media/files/b/0a9cba86/dE6DiG_XxfaZ3vKZUh17x_video.mp4',
  11: 'https://v3b.fal.media/files/b/0a9cba8a/eFTmcJLaqdJafSPv-thHZ_video.mp4',
};

(async () => {
  const b = await prisma.build.findUnique({ where: { id } });
  if (!b) { console.error('build not found'); process.exit(1); }
  const s = (b.state && typeof b.state === 'object') ? b.state : {};
  s.beatVideos = beatVideos;
  s.assembledVideoUrl = master;
  s.generationComplete = true;
  s.lockedDurationSeconds = null;
  await prisma.build.update({ where: { id }, data: { state: s, stepIndex: FINISHED_STEP, petName: b.petName ?? null } });
  console.log('restored build', id);
  console.log('  beatVideos:', Object.keys(beatVideos).length);
  console.log('  assembledVideoUrl:', master);
  console.log('  stepIndex:', FINISHED_STEP);
})().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
