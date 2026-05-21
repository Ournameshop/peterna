import 'server-only';

/**
 * Tiny envelope helpers for the `{ ok: true, ... } | { ok: false, error, ... }` convention
 * used across every route in `api-routes.md`. Keeping this in one place means changing the
 * shape later is one line, not 9 routes.
 *
 * Never leak vendor names or model snapshots through these helpers — the routes pick the
 * `error` kebab-string, and that string is the only thing the client sees.
 */

type JsonInit = { status?: number; headers?: HeadersInit };

export function okJson<T extends Record<string, unknown>>(data: T, init: JsonInit = {}): Response {
  return Response.json({ ok: true, ...data }, { status: init.status ?? 200, headers: init.headers });
}

export function errJson(
  error: string,
  init: (JsonInit & { details?: Record<string, unknown> }) = {},
): Response {
  return Response.json(
    { ok: false, error, ...(init.details ?? {}) },
    { status: init.status ?? 400, headers: init.headers },
  );
}
