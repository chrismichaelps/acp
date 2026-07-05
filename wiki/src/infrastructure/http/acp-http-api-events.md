---
type: module
path: '@root/src/infrastructure/http/acp-http-api-events.ts'
fidelity: Active
domain: '[[Event]]'
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.62
depth_status: MEDIUM
tags: [module, seam, medium]
aliases: [acp-http-api-events, EventsGroup]
---

# ACP HTTP API Events

## Purpose

Declare the event replay and live stream HTTP contract for [[acp-http-api]].
Keeping event query parameters and the `EventsGroup` in a focused module preserves
the central API file as the composition surface while leaving event replay owned
by [[event-store]] and implemented by [[event-routes]].

## Interface

### Signatures

```typescript
export const EventsStreamParams: Schema.Struct<{ workspace_id: WorkspaceId }>
export const EventsReplayParams: Schema.Struct<{
  workspace_id: WorkspaceId
  after_seq: number
  limit: Option<number>
}>
export const EventsGroup: HttpApiGroup.HttpApiGroup<'events', ...>
```

### Routes

`GET /v1/events?workspace_id=...&after_seq=...&limit=...` replays ordered
workspace events after a non-negative sequence cursor, optionally capped by a
positive row limit. `GET /v1/events/stream?workspace_id=...` declares the live
SSE stream surface for clients that prefer subscription over polling.

## Algorithm

`EventsReplayParams` validates the storage scan key directly: `workspace_id`, an
`after_seq` cursor defaulting to zero, and an optional positive `limit`. The
group declares both event endpoints with the shared `ProtocolError` schema and
returns arrays of [[Event]] records in the reflected API contract; the runtime
streaming response remains implemented in [[event-routes]].

## Negative Logic (Prohibited Paths)

- ❌ Do NOT add event persistence or replay logic here.
- ❌ Do NOT accept negative cursors; ordered replay depends on monotonic
  non-negative sequences.
- ❌ Do NOT accept zero or negative limits; bounded replay must request at least
  one event.
- ❌ Do NOT drift endpoint paths from [[router]].

## Depth

MEDIUM (0.62). The module is declarative, but it protects a performance-sensitive
recovery contract: agents replay thousands of events by workspace and sequence,
so the query shape must stay aligned with the storage index.

## Referenced by

[[acp-http-api]] · [[event-routes]] · [[event-store]] · [[Transport]] ·
[[src/_MOC]]
