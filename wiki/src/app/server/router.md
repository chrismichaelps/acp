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
v0.1. A manual `HttpRouter` composes focused route handlers, the SSE stream
endpoint, and `/rpc` JSON-RPC framing over one shared application graph. Shared
authorization, success encoding, and error folding live in [[route-support]].

## Interface

### Signatures

```typescript
export const acpRouter: HttpRouter.HttpRouter<
  never,
  | WorkUnitService
  | WorkerService
  | WorkspaceService
  | LeaseService
  | ArtifactService
  | CheckpointService
  | ReviewService
  | EventStore
  | IdClock
  | AppConfigTag
>
```

### Routes (spec §12)

- `POST /v1/session/initialize` → register [[Worker]], mint a [[session-service]]
  session, return `session_id` (the v0.1 bearer token) + host capabilities (spec
  §9); accepts both full internal [[Worker]] records and draft §9
  `protocol_version` + client capability handshakes, rejecting unsupported
  versions through [[protocol-version]]
- `GET /v1/workers` · `GET /v1/workers/:worker_id` → read host-scoped
  [[Worker]] registry state through [[worker-routes]]
- `GET  /v1/workspaces` → list [[Workspace]]s
- `POST /v1/workspaces` · `PATCH /v1/workspaces/:workspace_id` → create/update
  [[Workspace]]s through [[workspace-routes]]
- `GET /v1/workspaces/:workspace_id/work` → list [[WorkUnit]]s in a workspace
  through [[workspace-routes]]
- `GET /v1/workspaces/:workspace_id/checkpoints`
  · `GET /v1/workspaces/:workspace_id/artifacts`
  · `GET /v1/workspaces/:workspace_id/reviews` → list workspace-scoped resume
  evidence and review gates through [[workspace-routes]]
- `POST /v1/work` · `GET /v1/work/:work_id`
  · `POST /v1/work/:work_id/claim` · `PATCH /v1/work/:work_id`
  · `POST /v1/work/:work_id/events`
  · `GET /v1/work/:work_id/checkpoints`
  · `GET /v1/work/:work_id/checkpoints/latest`
  · `GET /v1/work/:work_id/artifacts`
  · `GET /v1/work/:work_id/reviews`
- `POST /v1/leases` · `POST /v1/leases/:lease_id/renew`
  · `POST /v1/leases/:lease_id/release` (→ 204)
  · `POST /v1/leases/:lease_id/revoke`
- `POST /v1/artifacts` · `PATCH /v1/artifacts/:artifact_id`
  · `DELETE /v1/artifacts/:artifact_id`
  · `GET /v1/artifacts/:artifact_id/content`
  · `POST /v1/checkpoints` · `POST /v1/reviews`
  · `POST /v1/reviews/:review_id/approve`
  · `POST /v1/reviews/:review_id/reject`
  · `POST /v1/reviews/:review_id/request_changes`
  · `POST /v1/reviews/:review_id/cancel`
- `GET /v1/events?workspace_id=…&after_seq=…` → replay workspace [[Event]]
  history through [[event-routes]]
- `GET  /v1/events/stream?workspace_id=…` → SSE ([[event-routes]] /
  [[sse-event-stream]])
- `POST /rpc` → JSON-RPC 2.0 framing ([[rpc-endpoint]]); the `/v1` routes above are
  built as `v1Router`, and `acpRouter = v1Router + POST /rpc` so JSON-RPC dispatch
  replays into `v1Router` (never into `/rpc`)

### Linkage

- **Requires:** domain service barrels used by inline handlers, [[event-store]],
  [[id-clock]], [[acp-http-api]] (payload schemas), [[route-support]],
  [[workspace-routes]], [[worker-routes]], [[resume-routes]], [[event-routes]],
  [[sse-event-stream]], [[rpc-endpoint]] (`POST /rpc` handler)
- **Consumed by:** [[server-main]] (the Node entrypoint).

## Algorithm

Per inline route: decode body (`HttpServerRequest.schemaBodyJson`) / path
(`HttpRouter.params`) / query (`schemaSearchParams`) → mint `id`/`now` from
[[id-clock]] where the service requires them → delegate → encode success through
[[route-support]]. Workspace list/create/update are delegated to
[[workspace-routes]] to keep this composition module below the file-size gate.
Work-scoped resume reads are delegated to [[resume-routes]] for the same reason.
Those reads include current work, checkpoint history/latest, artifact metadata,
review gates, and host-stored artifact content.
Worker registry reads are delegated to [[worker-routes]], keeping host-scoped
presence separate from workspace event history.
Event replay and live SSE routes are delegated to [[event-routes]], keeping
append-only timeline reads and stream response construction out of this
composition module.
Workspace-scoped resume aggregates stay in [[workspace-routes]] beside the
workspace work index and delegate to the owning domain services'
`listForWorkspace` methods.

`initializeSession` is the one route with compatibility normalization. The HTTP
schema accepts the draft spec handshake, where worker capability booleans sit
beside a lean worker descriptor. The router first checks `protocol_version`
against [[protocol-version]] and rejects unsupported client versions as
`invalid_request`; successful responses echo the canonical
`ACP_PROTOCOL_VERSION`. It then derives the stored [[Worker]] capability array
from those booleans when the worker record did not already carry capabilities,
defaults missing worker status to `online`, and preserves `permissions` as the
host's bearer-scope extension.

`createArtifact` and `updateArtifact` decode the shared artifact payload schemas,
including optional external `uri`, and delegate URI/content ownership to
[[artifact-service]]. `updateArtifact` returns the updated metadata at `200` and
lets the service emit `artifact.updated`. `deleteArtifact` delegates to
[[artifact-service]] `remove`, returns the deleted metadata at `200`, and lets the
service emit `artifact.deleted`. A missing artifact maps through the shared domain
error path to `404`.

Backed mutations and sensitive reads require their matching session scope when a bearer token is
present: worker reads, event replay, work update/event publication, lease
renew/release/revoke, artifact update/delete, and review
approve/reject/request-changes/cancel each call [[route-support]] `authorize`
with the specific action scope. Missing tokens still follow the local-host
`worker_system` fallback unless
`ACP_REQUIRE_AUTH=true`.

Every inline handler is wrapped with [[route-support]] `respond` using a stable
`METHOD /template/:param` route label. Request lifecycle logs therefore carry
low-cardinality route/status/duration/error-code telemetry without logging raw
URLs or identifiers.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT put business logic in handlers — decode → delegate → encode only.
- ❌ Do NOT hand-build JSON — always `Schema.encode`.
- ❌ Do NOT leak internal error causes — `errorToResponse` collapses unknowns to
  `internal_error`.
- ❌ Do NOT import Node built-ins here — the runtime lives in [[server-main]].

## Depth

DEEP (0.72). Hides route composition, identity minting, and transport adapter
composition behind a single router value. Deleting it scatters HTTP ceremony and
`/rpc` replay wiring across multiple entrypoints.

## Grill Log

- **Q:** `HttpApiBuilder` typed errors or a manual `HttpRouter`?
  **A:** Manual `HttpRouter`. _Rationale:_ the merged contract declares one
  `ProtocolError` schema across 400/404/409, so typed-error status mapping is
  ambiguous; meanwhile [[http-error-mapper]]'s `toHttpErrorResponse` already returns
  a correct-status `HttpServerResponse` from any domain error, and
  [[sse-event-stream]] already returns a streaming `HttpServerResponse`. A router
  reuses both, gives exact status codes, and leaves the published [[acp-http-api]]
  contract untouched. _Rejected:_ refactor `AcpHttpApi` into per-status wire-error
  classes (edits already-merged contract + page for no runtime gain at v0.1).
- **Q:** Where do the `actor`/`createdBy` worker ids come from, since payloads such
  as `CreateWorkPayload` and the `PATCH state` body omit them?
  **A:** The `authorize(scope?)` helper resolves them from the
  `Authorization: Bearer <session_id>` header against [[session-service]] (spec §8):
  no token → `worker_system` when [[app-config]] `requireAuth` is false (the default
  local-host mode), or `401 unauthorized` when `requireAuth` is true; a token with no
  matching session, or a session lacking the required scope → `401 unauthorized`;
  otherwise the session's worker id. Scoped routes pass their spec §8 scope
  (`createWork`→`work:create`, `listWorkspaces`→`workspace:read`, …); the
  unlisted mutations (`PATCH state`, `events`, `release`, review decisions) call
  `authorize()` with no scope (attribute-only). _Rationale:_ attributes mutations
  to the real worker and enforces declared scopes while keeping the local host
  usable without a credential store; `requireAuth` is the reversible tightening
  for a hardened deployment. _Rejected:_ inventing a body field not in the wire
  schema.
- **Q:** When `ACP_REQUIRE_AUTH` is set, does `session/initialize` also require a
  token?
  **A:** No — `initializeSession` never calls `authorize`; it is the one open route
  that _mints_ the first session, so a client can always bootstrap a credential.
  Only mutations gated by `authorize` reject the empty token. _Rationale:_ a closed
  `initialize` would be unbootstrappable. _Rejected:_ a separate bootstrap secret at
  v0.1 (no credential store yet).
- **Q:** Identity + clock — a formal seam now?
  **A:** A small [[id-clock]] service (counter + `Clock`), not yet a swappable
  production seam. _Rationale:_ services intentionally do not mint ids/timestamps;
  the composition root must. A `Ref` counter + `Clock.currentTimeMillis` is
  deterministic and testable. Promote to a seam when a second strategy (UUID,
  snowflake) is real.

## Referenced by

[[server-index]] · [[server-main]] · [[Transport]] · [[route-support]] ·
[[workspace-routes]] · [[event-routes]] · [[protocol-version]] · [[src/_MOC]]
