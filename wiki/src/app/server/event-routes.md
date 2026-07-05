---
type: module
path: '@root/src/app/server/event-routes.ts'
fidelity: Active
domain: '[[Event]]'
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.67
depth_status: MEDIUM
tags: [module, seam, medium]
aliases: [event-routes]
---

# Event Routes

## Purpose

Expose workspace [[Event]] delivery over HTTP without mixing replay and live
stream behavior into [[acp-router]]. Live delivery stays delegated to
[[sse-event-stream]], while replay reads expose [[event-store]] `readAfter` for
recovering clients that need the append-only timeline before opening SSE or
WebSocket subscriptions.

## Interface

### Signatures

```typescript
export const replayEvents: Effect<
  HttpServerResponse,
  never,
  EventStore | AppConfigTag | SessionService | HttpServerRequest
>
export const streamEvents: Effect<
  HttpServerResponse,
  never,
  EventStore | AppConfigTag | SessionService | HttpServerRequest | Scope
>
```

### Routes

- `GET /v1/events?workspace_id=<id>&after_seq=<n>&limit=<n>` → `event:read`
- `GET /v1/events/stream?workspace_id=<id>` → `event:read`, live SSE stream

### Linkage

- **Requires:** [[event-store]], [[sse-event-stream]], [[route-support]],
  [[acp-http-api]], [[event.schema]]
- **Consumed by:** [[acp-router]]

## Algorithm

`replayEvents` decodes `workspace_id`, optional non-negative integer
`after_seq`, and optional positive integer `limit` query params, authorizes
`event:read`, delegates to [[event-store]] `readAfter`, converts the returned
`Chunk` to a JSON array, and schema-encodes each [[Event]] through
[[route-support]] `ok`. `streamEvents`
decodes the existing live query params, authorizes the same `event:read` scope,
and delegates to [[sse-event-stream]] without changing its wire format. Both
handlers pass stable route templates to [[route-support]] `respond` so replay
and SSE telemetry avoid raw workspace ids.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT include host-scoped worker presence in replay; per
  [[ADR-0005-worker-presence-scope]], worker presence is registry state.
- ❌ Do NOT replay by scanning all workspaces or trimming bounded reads after an
  unbounded storage fetch; keep the `(workspace_id, seq)` storage shape and pass
  `limit` to [[event-store]].
- ❌ Do NOT merge SSE framing into replay responses; replay is ordinary JSON.

## Depth

MEDIUM (0.67). The module is a thin transport projection, but it keeps live
streaming and replay reads out of the already-dense router composition.

## Grill Log

- **Q:** Route shape: path params or query params?
  **A:** `GET /v1/events?workspace_id=<id>&after_seq=<n>&limit=<n>`.
  _Rationale:_ the existing live route already treats event subscriptions as
  workspace-query reads, and the underlying storage cursor plus optional cap are
  query-like. _Rejected:_ embedding workspace id in the path, which would split
  live and replay address shapes.
- **Q:** Which scope gates replay?
  **A:** `event:read`, and the same scope gates live event streams. _Rationale:_
  replay and SSE both expose potentially sensitive timeline history and should
  not reuse mutation scopes or broad workspace reads. _Rejected:_
  `workspace:read` (too broad) and no scope (unsafe in required-auth mode).
- **Q:** Should replay limiting be transport-only or storage-backed?
  **A:** Storage-backed. _Rationale:_ large agent workspaces should not decode
  thousands of events just to print a short recovery tail. The HTTP route passes
  `limit` through [[event-store]] so SQLite and Postgres can apply SQL `LIMIT`.
  _Rejected:_ array slicing in the route, which would save response tokens but
  not storage work.

## Referenced by

[[acp-router]] · [[event-store]] · [[sse-event-stream]] · [[src/_MOC]]
