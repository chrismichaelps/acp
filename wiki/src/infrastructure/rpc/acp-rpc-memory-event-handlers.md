---
type: module
path: '@root/src/infrastructure/rpc/acp-rpc-memory-event-handlers.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.62
depth_status: MEDIUM
tags: [module, medium, rpc, memory, events]
aliases: [acp-rpc-memory-event-handlers]
---

# ACP RPC Memory & Event Handlers

## Purpose

Own the native `@effect/rpc` memory and event handler vertical, closing the last
[[acp-rpc-contract]] coverage gap where `memory.create`, `memory.list`, and
`events.list` were declared but unbacked. Keeping this vertical in its own module
prevents [[acp-rpc-handlers]] from growing past the file-size gate while every
recall and replay path stays single-sourced in [[memory-service]] and the
[[event-store]].

## Interface

```typescript
export const AcpRpcMemoryEventHandlersLive: Layer<
  | Rpc.Handler<'memory.create'>
  | Rpc.Handler<'memory.list'>
  | Rpc.Handler<'events.list'>,
  never,
  MemoryService | EventStore | IdClock
>
```

## Algorithm

`memory.create` authorizes `memory:create`, mints a memory id and timestamp
through [[id-clock]], and delegates to [[memory-service]] so seq assignment and
`memory.created` event emission remain domain-owned. `memory.list` authorizes
`memory:read` and forwards the decoded `ReadMemoryQuery` (Option-wrapped cursor,
kind, key, and label filters) straight to `memory.read` — the RPC payload is
already the native query shape, so no URL re-decode is needed unlike the
[[json-rpc-memory-commands]] HTTP bridge.

`events.list` authorizes `event:read`, reads through `EventStore.readAfter`, and
converts the returned `Chunk` to a readonly array, matching the HTTP replay
route. Live streaming (`events.subscribe`) stays out of scope: it remains a
rejected JSON-RPC method pending native streaming work.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT re-decode the memory query through URL params — the RPC payload is
  already `ReadMemoryQuery`.
- ❌ Do NOT add `events.subscribe` streaming here.
- ❌ Do NOT dispatch through HTTP, JSON-RPC, stdio, or WebSocket adapters.

## Depth

MEDIUM (0.62). A transport-thin vertical, but it guards memory seq/event
coupling and finishes the native handler set for [[acp-rpc-contract]].

## Referenced by

[[acp-rpc-handlers]] · [[rpc-index]] · [[rpc/_MOC]]
