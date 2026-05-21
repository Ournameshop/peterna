// server-only — never import from a client component
import { Pool } from 'pg';

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS tributes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_name     text        NOT NULL,
  video_url    text        NOT NULL,
  opening_text text,
  closing_text text,
  years        text,
  creator_name text,
  created_at   timestamptz NOT NULL DEFAULT now()
)`;

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }
  if (!globalThis.__pgPool) {
    globalThis.__pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return globalThis.__pgPool;
}

let tableEnsured = false;

export async function query<T extends object = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<import('pg').QueryResult<T>> {
  const pool = getPool();
  if (!tableEnsured) {
    await pool.query(CREATE_TABLE_SQL);
    tableEnsured = true;
  }
  return pool.query<T>(text, params);
}
