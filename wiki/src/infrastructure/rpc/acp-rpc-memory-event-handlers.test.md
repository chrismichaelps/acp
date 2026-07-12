---
type: module
path: '@root/src/infrastructure/rpc/acp-rpc-memory-event-handlers.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, infrastructure, rpc, memory, event]
aliases: [acp-rpc-memory-event-handlers.test]
---

# ACP RPC Memory and Event Handler Tests

## Purpose

Prove [[acp-rpc-memory-event-handlers]] direct event replay, memory persistence,
scope enforcement, and middleware actor attribution.

## Interface

Vitest `accessHandler` suite over the native RPC test runtime.

## Algorithm

Create workspace/work, publish a progress event, and replay it with cursor and
limit. Create a decision memory record, list it from sequence zero, and require
its first workspace sequence. Initialize a session without `event:read` and
require replay denial. Provide `AcpRpcActor` directly and require memory creator
attribution.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT ignore event replay cursor or limit.
- ❌ Do NOT permit event reads with only workspace mutation scope.
- ❌ Do NOT assign memory sequence outside the domain/storage path.
- ❌ Do NOT discard a middleware-provided actor.

## Grill Log

- **Q:** Why cover replay and memory together? **A:** This vertical owns the
  native recall/replay boundary and their shared workspace authorization bridge.
  _Rejected:_ testing only persistence without scope failure.

## Referenced by

[[acp-rpc-memory-event-handlers]] · [[acp-rpc-handlers]] · [[rpc/_MOC]] ·
[[Transport]] · [[src/_MOC]]
