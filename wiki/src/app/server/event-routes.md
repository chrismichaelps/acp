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

- `GET /v1/events?workspace_id=<id>&after_seq=<n>` → `event:read`
- `GET /v1/events/stream?workspace_id=<id>` → live SSE stream

### Linkage

- **Requires:** [[event-store]], [[sse-event-stream]], [[route-support]],
  [[acp-http-api]], [[event.schema]]
- **Consumed by:** [[acp-router]]

## Algorithm

`replayEvents` decodes `workspace_id` and optional non-negative integer
`after_seq` query params, authorizes `event:read`, delegates to
[[event-store]] `readAfter`, converts the returned `Chunk` to a JSON array, and
schema-encodes each [[Event]] through [[route-support]] `ok`. `streamEvents`
decodes the existing live query params and delegates to [[sse-event-stream]]
without changing its wire format.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT include host-scoped worker presence in replay; per
  [[ADR-0005-worker-presence-scope]], worker presence is registry state.
- ❌ Do NOT replay by scanning all workspaces; keep the `(workspace_id, seq)`
  storage shape.
- ❌ Do NOT merge SSE framing into replay responses; replay is ordinary JSON.

## Depth

MEDIUM (0.67). The module is a thin transport projection, but it keeps live
streaming and replay reads out of the already-dense router composition.

## Grill Log

- **Q:** Route shape: path params or query params?
  **A:** `GET /v1/events?workspace_id=<id>&after_seq=<n>`. _Rationale:_ the
  existing live route already treats event subscriptions as workspace-query
  reads, and the underlying storage cursor is query-like. _Rejected:_ embedding
  workspace id in the path, which would split live and replay address shapes.
- **Q:** Which scope gates replay?
  **A:** `event:read`. _Rationale:_ replay exposes potentially sensitive
  timeline history and should not reuse mutation scopes or broad workspace reads.
  _Rejected:_ `workspace:read` (too broad) and no scope (unsafe in required-auth
  mode).
- **Q:** How large should the first replay API be?
  **A:** Cursor-only `after_seq`, no limit yet. _Rationale:_ storage already
  exposes this contract and the audit selected that exact shape; pagination can
  be added when a concrete large-history consumer needs it. _Rejected:_ adding
  a limit without storage support in the same slice.

## Referenced by

[[acp-router]] · [[event-store]] · [[sse-event-stream]] · [[src/_MOC]]
