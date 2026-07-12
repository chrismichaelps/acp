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

Own the native `@effect/rpc` memory and event handler vertical: memory
create/read, event replay, and event subscription. Keeping this vertical in its
own module prevents [[acp-rpc-handlers]] from growing past the file-size gate
while every recall, replay, and live event path stays single-sourced in
[[memory-service]] and the [[event-store]].

## Interface

```typescript
export const AcpRpcMemoryEventHandlersLive: Layer<
  | Rpc.Handler<'memory.create'>
  | Rpc.Handler<'memory.list'>
  | Rpc.Handler<'events.list'>
  | Rpc.Handler<'events.subscribe'>,
  never,
  MemoryService | EventStore | IdClock
>
```

## Algorithm

Handlers authorize through [[rpc-auth]] `rpcWorkspaceActor`, which consumes
`AcpRpcActor` when native RPC middleware has already authenticated the request
and falls back to bearer headers for direct `accessHandler` tests.
`memory.create` checks both `memory:create` and the payload workspace binding,
mints a memory id and timestamp through [[id-clock]], and delegates to
[[memory-service]] so seq assignment and `memory.created` event emission remain
domain-owned. `memory.list` checks `memory:read` plus the explicit
`workspace_id` binding and forwards the decoded `ReadMemoryQuery`
(Option-wrapped cursor, kind, key, and label filters) straight to `memory.read` —
the RPC payload is already the native query shape, so no URL re-decode is needed
unlike the [[json-rpc-memory-commands]] HTTP bridge.

`events.list` checks `event:read` plus the explicit workspace binding, reads
through `EventStore.readAfter` with the optional replay limit, and converts the
returned `Chunk` to a readonly array, matching the HTTP replay route.
`events.subscribe` checks `event:read`
plus the explicit workspace binding and returns the scoped
`EventStore.subscribe(workspace_id)` stream directly to `@effect/rpc`, so the
native NDJSON HTTP route can deliver future workspace events as stream chunks.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT re-decode the memory query through URL params — the RPC payload is
  already `ReadMemoryQuery`.
- ❌ Do NOT dispatch through HTTP, JSON-RPC, stdio, or WebSocket adapters.

## Depth

MEDIUM (0.62). A transport-thin vertical, but it guards memory seq/event
coupling and finishes the native handler set for [[acp-rpc-contract]].

## Referenced by

[[acp-rpc-handlers]] · [[acp-rpc-memory-event-handlers.test]] · [[rpc-index]] ·
[[rpc/_MOC]]
