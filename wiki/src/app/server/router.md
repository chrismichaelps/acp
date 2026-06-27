---
type: module
path: '@root/src/app/server/router.ts'
fidelity: Active
domain: '[[Workspace]]'
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.72
depth_status: DEEP
tags: [module, seam, deep]
aliases: [acp-router, server-router]
---

# ACP HTTP Router

## Purpose

Bind the declarative [[acp-http-api]] contract to the running domain services for
v0.1. A manual `HttpRouter` decodes each request, mints identity/clock values,
delegates to the owning service, encodes the success body, and maps every domain
error to its HTTP status via the existing [[http-error-mapper]]. The SSE stream
endpoint delegates to [[sse-event-stream]].

## Interface

### Signatures

```typescript
export const acpRouter: HttpRouter.HttpRouter<
  never,
  | WorkUnitService | WorkerService | WorkspaceService | LeaseService
  | ArtifactService | CheckpointService | ReviewService
  | EventStore | IdClock | AppConfigTag
>
```

### Routes (spec §12)

- `POST /v1/session/initialize` → register [[Worker]], mint a [[session-service]]
  session, return `session_id` (the v0.1 bearer token) + host capabilities (spec §9)
- `GET  /v1/workspaces` → list [[Workspace]]s
- `POST /v1/work` · `POST /v1/work/:work_id/claim` · `PATCH /v1/work/:work_id`
  · `POST /v1/work/:work_id/events`
- `POST /v1/leases` · `POST /v1/leases/:lease_id/release` (→ 204)
- `POST /v1/artifacts` · `POST /v1/checkpoints` · `POST /v1/reviews`
- `GET  /v1/events/stream?workspace_id=…` → SSE ([[sse-event-stream]])

### Linkage

- **Requires:** all domain service barrels, [[event-store]], [[id-clock]],
  [[app-config]], [[acp-http-api]] (payload schemas), [[http-error-mapper]],
  [[sse-event-stream]]
- **Consumed by:** [[server-main]] (the Node entrypoint).

## Algorithm

Per route: decode body (`HttpServerRequest.schemaBodyJson`) / path
(`HttpRouter.params`) / query (`schemaSearchParams`) → mint `id`/`now` from
[[id-clock]] where the service requires them → delegate → `Schema.encode` the
success at the declared status → `Effect.catchAll` routes any failure through
`errorToResponse`: tagged [[protocol-error]] domain errors use
[[http-error-mapper]]; decode/`ParseError`/`RequestError` collapse to `400`
validation; anything else is `internal_error` `500` (no internal leak).

## Negative Logic (Prohibited Paths)

- ❌ Do NOT put business logic in handlers — decode → delegate → encode only.
- ❌ Do NOT hand-build JSON — always `Schema.encode`.
- ❌ Do NOT leak internal error causes — `errorToResponse` collapses unknowns to
  `internal_error`.
- ❌ Do NOT import Node built-ins here — the runtime lives in [[server-main]].

## Depth

DEEP (0.72). Hides decode/encode plumbing, identity minting, and the total
error→status mapping behind a single router value. Deleting it scatters HTTP
ceremony across twelve endpoints.

## Grill Log

- **Q:** `HttpApiBuilder` typed errors or a manual `HttpRouter`?
  **A:** Manual `HttpRouter`. *Rationale:* the merged contract declares one
  `ProtocolError` schema across 400/404/409, so typed-error status mapping is
  ambiguous; meanwhile [[http-error-mapper]]'s `toHttpErrorResponse` already returns
  a correct-status `HttpServerResponse` from any domain error, and
  [[sse-event-stream]] already returns a streaming `HttpServerResponse`. A router
  reuses both, gives exact status codes, and leaves the published [[acp-http-api]]
  contract untouched. *Rejected:* refactor `AcpHttpApi` into per-status wire-error
  classes (edits already-merged contract + page for no runtime gain at v0.1).
- **Q:** Where do the `actor`/`createdBy` worker ids come from, since payloads such
  as `CreateWorkPayload` and the `PATCH state` body omit them?
  **A:** The `authorize(scope?)` helper resolves them from the
  `Authorization: Bearer <session_id>` header against [[session-service]] (spec §8):
  no token → `worker_system` (unauthenticated, full access); a token with no
  matching session, or a session lacking the required scope → `401 unauthorized`;
  otherwise the session's worker id. Scoped routes pass their spec §8 scope
  (`createWork`→`work:create`, `listWorkspaces`→`workspace:read`, …); the
  unlisted mutations (`PATCH state`, `events`, `release`) call `authorize()` with
  no scope (attribute-only). *Rationale:* attributes mutations to the real worker
  and enforces declared scopes while keeping the local host usable without a
  credential store. *Rejected:* (a) inventing a body field not in the wire schema;
  (b) hard-failing *unauthenticated* mutations with `401` (deferred — see
  [[session-service#Grill Log]]).
- **Q:** Identity + clock — a formal seam now?
  **A:** A small [[id-clock]] service (counter + `Clock`), not yet a swappable
  production seam. *Rationale:* services intentionally do not mint ids/timestamps;
  the composition root must. A `Ref` counter + `Clock.currentTimeMillis` is
  deterministic and testable. Promote to a seam when a second strategy (UUID,
  snowflake) is real.

## Referenced by

[[server-index]] · [[server-main]] · [[Transport]] · [[src/_MOC]]
