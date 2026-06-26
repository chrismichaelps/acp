---
type: module
path: '@root/src/infrastructure/sse/sse-event-stream.ts'
fidelity: Active
domain: '[[Event]]'
grammar: '[[grammar/typescript]]'
seam: '[[EventStream]]'
depth_score: 0.73
depth_status: DEEP
tags: [module, deep, seam]
aliases: [sse-event-stream, SseEventStream]
---

# SSE Event Stream

## Purpose

Render live [[EventStore]] subscriptions as Server-Sent Events for
`GET /v1/events/stream`. This adapter owns wire formatting (`event:`, `data:`,
heartbeat comments, response headers) while [[EventStore]] owns persistence and
workspace filtering.

## Interface

### Signatures

```typescript
export class SseEncodeError extends Data.TaggedError('SseEncodeError')<{
  readonly cause: string
}> {}

export const encodeSseEventFrame: (
  event: Event,
) => Effect<string, SseEncodeError>
export const heartbeatFrame: string
export const eventsToSseText: <E, R>(
  events: Stream<Event, E, R>,
) => Stream<string, E | SseEncodeError, R>
export const eventsToSseBytes: <E, R>(
  events: Stream<Event, E, R>,
) => Stream<Uint8Array, E | SseEncodeError, R>
export const toSseResponse: (
  events: Stream<Event, SseEncodeError, never>,
) => HttpServerResponse
export const workspaceSseResponse: (
  workspaceId: string,
) => Effect<HttpServerResponse, never, EventStore | AppConfigTag | Scope>
```

### Linkage

- **Requires:** [[event-store]], [[event.schema]], [[app-config]]
- **Consumed by:** future HTTP handler for `streamEvents`.

## Algorithm

1. Encode each typed [[Event]] through [[event.schema]] so `Option` fields become
   JSON-safe wire values.
2. Render frames as `event: <type>\ndata: <encoded-event-json>\n\n`.
3. Convert frame text to `Uint8Array` via `Stream.encodeText`.
4. `workspaceSseResponse` acquires an [[EventStore]] workspace subscription,
   merges `Stream.tick(config.sseHeartbeat)` heartbeat comments, and returns an
   `HttpServerResponse.stream` with `text/event-stream`, `cache-control: no-cache`,
   and `connection: keep-alive`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT persist or sequence events here; [[EventStore]] already owns that.
- ❌ Do NOT leak raw Effect `Option` objects into JSON; schema-encode first.
- ❌ Do NOT render HTTP route handlers here; this adapter only builds responses.

## Depth

DEEP (0.73). Centralizes every SSE wire invariant and keeps transport formatting
out of domain services.

## Referenced by

[[sse-index]] · [[EventStream]] · [[src/_MOC]]
