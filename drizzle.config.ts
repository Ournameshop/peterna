import { config as loadEnv } from 'dotenv';
import type { Config } from 'drizzle-kit';

// Load .env.local for db:generate / db:migrate / db:push / db:studio so the
// CLI sees the same DATABASE_URL Next.js does at runtime.
loadEnv({ path: '.env.local' });

export default {
  schema: './src/lib/db/schema.ts',
  out: './src/lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
} satisfies Config;
