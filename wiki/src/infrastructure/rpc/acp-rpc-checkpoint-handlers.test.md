---
type: module
path: '@root/src/infrastructure/rpc/acp-rpc-checkpoint-handlers.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, infrastructure, rpc, checkpoint]
aliases: [acp-rpc-checkpoint-handlers.test]
---

# ACP RPC Checkpoint Handler Tests

## Purpose

Pin [[acp-rpc-checkpoint-handlers]] append-only creation, newest-first indexes,
latest lookup, missing semantics, and middleware actor attribution.

## Interface

Vitest `accessHandler` suite over the native RPC test runtime.

## Algorithm

Create two ordered checkpoints for one work unit, list by work/workspace in
newest-first order, and require latest to select the second. Require latest on a
work with no checkpoints to return typed `not_found`. Provide `AcpRpcActor` with
an invalid bearer and require creation to use the middleware actor.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT reorder checkpoints oldest-first.
- ❌ Do NOT return an empty optional for the RPC latest method.
- ❌ Do NOT require valid bearer lookup after middleware authentication.

## Grill Log

- **Q:** Why force a small time separation? **A:** Newest-first and latest are
  timestamp contracts; distinct instants make selection deterministic.
  _Rejected:_ depending on insertion stability for equal timestamps.

## Referenced by

[[acp-rpc-checkpoint-handlers]] · [[acp-rpc-handlers]] · [[rpc/_MOC]] ·
[[Transport]] · [[src/_MOC]]
