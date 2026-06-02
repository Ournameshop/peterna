// server-only — never import from a client component.
// Singleton PrismaClient (survives Next dev HMR). Coexists with the raw-`pg`
// pool in src/lib/db.ts — both share DATABASE_URL but own different tables.
import { PrismaClient } from '@prisma/client';

declare global {
  var __prisma: PrismaClient | undefined;
}

// Always cache on globalThis so module-cache invalidation (dev HMR, or any
// serverless re-import) reuses one client instead of leaking PG connections.
if (!globalThis.__prisma) {
  globalThis.__prisma = new PrismaClient();
}
export const prisma: PrismaClient = globalThis.__prisma;
