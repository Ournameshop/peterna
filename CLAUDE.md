@AGENTS.md

## Tribute Builder

Multi-stage AI tribute wizard. Specs and dispatch index live in `docs/tribute-builder/README.md`; the anchor doc is `docs/tribute-builder/architecture.md`.

New top-level directories (added in Phase 0):
- `src/lib/db/` — Drizzle + Postgres schema, client, migrations
- `src/lib/storage/` — Cloudflare R2 wrapper
- `src/lib/ai/` — hybrid vendor layer (image / vision / video capabilities; OpenAI / Gemini / fal.ai)
- `src/lib/session/` — HMAC token helpers (cookie + resume tokens)
- `src/lib/library/` — server-only TS content (copy, formats, themes, art styles, etc.) with load-time validator
