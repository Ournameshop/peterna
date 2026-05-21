import 'server-only';

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

// Using `postgres` (postgres-js) over `pg`: lighter, Promise-native, smaller deps, and the
// Drizzle docs treat it as the default Postgres driver. Either works; we pick one consistently.

type Client = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  var __peternaDb: Client | undefined;
  var __peternaSql: ReturnType<typeof postgres> | undefined;
}

function buildClient(): { db: Client; sql: ReturnType<typeof postgres> } {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Add it to .env (see .env.example).');
  }
  const sql = postgres(url, { prepare: false });
  const db = drizzle(sql, { schema });
  return { db, sql };
}

export function getDb(): Client {
  if (!globalThis.__peternaDb) {
    const { db, sql } = buildClient();
    globalThis.__peternaDb = db;
    globalThis.__peternaSql = sql;
  }
  return globalThis.__peternaDb;
}

export function getSql(): ReturnType<typeof postgres> {
  if (!globalThis.__peternaSql) {
    getDb();
  }
  return globalThis.__peternaSql!;
}

export { schema };
