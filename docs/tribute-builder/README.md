# Tribute Builder — docs index

Anchor doc: **`architecture.md`** (the mega-doc). Every agent reads it once for context, then drops into the per-concern doc that owns their slice.

## Where do I start?

| You are... | Read first | Then |
|---|---|---|
| **Frontend agent** | `ui-components.md` | `copy-and-content.md` + `architecture.md` §6 |
| **Backend agent (routes)** | `api-routes.md` | `vendor-layer.md` + `data-model.md` |
| **Backend agent (AI / vendor wiring)** | `vendor-layer.md` | `api-routes.md` + risk #4 in `risk-register.md` |
| **Backend agent (storage / schema)** | `data-model.md` | `api-routes.md` |
| **QA agent** | `phase-plan.md` (definition-of-done per phase) | `architecture.md` §9 (risks) + `api-routes.md` (response shapes) |
| **DevOps** | `vendor-layer.md` (env vars) + `data-model.md` (DB + S3) | `architecture.md` §5 |
| **PM / scrum** | `phase-plan.md` | `risk-register.md` |
| **Architect (revisions)** | `architecture.md` | `risk-register.md` decision log |

## Doc inventory

- `architecture.md` — anchor; vendor matrix, stage scope, deferred work, top-line risks
- `vendor-layer.md` — hybrid AI abstraction; interface, error contract, env vars, observability
- `data-model.md` — Postgres schema, S3 layout, library data shape, retention
- `api-routes.md` — Phase-1 route surface; request/response, idempotency, rate limits
- `ui-components.md` — wizard component architecture; five widget patterns; state machine
- `copy-and-content.md` — locked verbatim copy + library content shape
- `phase-plan.md` — phased build sequence; definition-of-done; dispatch order
- `risk-register.md` — top risks, mitigations, decision log

## Rule of thumb

If a per-concern doc disagrees with `architecture.md`, the **per-concern doc wins** — the mega-doc is a summary and intentionally lags behind the slice docs by a revision or two. Architect keeps the mega-doc in sync.
