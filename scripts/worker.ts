/**
 * Worker entrypoint — run via `npm run worker` (uses `tsx`).
 *
 * Stays alive until the process receives SIGINT / SIGTERM. The worker module
 * itself manages the polling intervals; this script just keeps the event
 * loop pinned and stops gracefully.
 *
 * Env: same as the Next.js server (DATABASE_URL, S3_*, FAL_KEY, etc.). Load
 * `.env.local` via `dotenv/config` if you're running outside of a deployment
 * that injects env automatically.
 */

import { startWorker, workerId } from '../src/lib/queue/worker';

const handle = startWorker();
const id = workerId();
console.log(`[worker ${id}] started`);

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[worker ${id}] received ${signal}, stopping`);
  try {
    await handle.stop();
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

// Keep the process alive — `setInterval` inside `startWorker` already does
// that, but this guard makes the intent explicit.
process.stdin.resume();
