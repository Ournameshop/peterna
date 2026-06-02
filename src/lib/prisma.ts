// server-only — never import from a client component.
// Singleton PrismaClient (survives Next dev HMR). Coexists with the raw-`pg`
// pool in src/lib/db.ts — both share DATABASE_URL but own different tables.
import { PrismaClient } from '@prisma/client';

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient = globalThis.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}
