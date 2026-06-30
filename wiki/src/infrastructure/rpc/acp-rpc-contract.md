---
type: module
path: '@root/src/infrastructure/rpc/acp-rpc-contract.ts'
fidelity: Planned
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.72
depth_status: DEEP
tags: [module, planned, seam, rpc]
aliases: [acp-rpc-contract, effect-rpc-contract]
---

# ACP RPC Contract

## Purpose

Declare the native first-party ACP RPC surface selected by
[[ADR-0007-effect-rpc-adoption]]. The contract replaces the hand-mapped
JSON-RPC method table with an `@effect/rpc` `RpcGroup` over ACP protocol schemas
and typed errors. This page exists before implementation so the first source
slice can project code from a stable design rather than discovering the SDK in
the middle of a transport rewrite.

## Interface

The initial source module will export a single `AcpRpcGroup` plus operation
constants grouped by protocol area. Each operation uses the current protocol
schemas for payload and success values, and a typed error schema that preserves
domain failure categories without the JSON-RPC `-32602`/`-32603` collapse.

```typescript
export const AcpRpcGroup: RpcGroup.RpcGroup<...>
```

The first implementation stage should cover the existing non-streaming
workspace, worker, work, lease, artifact, checkpoint, review, event replay, and
memory operations. `events.subscribe` is reserved for the streaming stage because
it needs explicit `RpcSchema.Stream` handling and backpressure tests.

## Algorithm

Import `Rpc` and `RpcGroup` from `@effect/rpc`. Define one `Rpc.make(tag)` per
ACP operation, using current schema modules for payload and success. Read-only
operations with path/query parameters receive a payload schema that names those
parameters directly rather than encoding HTTP paths. Mutations reuse existing
payload schemas wherever the REST body already matches the domain command, and
add small parameter payload schemas only where REST currently carries ids in the
path.

The companion handler module, in a later source slice, will implement
`AcpRpcGroup.toLayer(...)` against the domain services, [[id-clock]], and the
same authorization semantics currently centralized in [[route-support]]. It must
call domain services directly; it must not dispatch through [[acp-router]] or
the JSON-RPC command map.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT import `@effect/rpc` in source until the direct dependency link is
  materialized by the package manager.
- ❌ Do NOT route native RPC handlers through REST paths or JSON-RPC envelopes.
- ❌ Do NOT delete [[jsonrpc/_MOC|JSON-RPC]] until the native contract, handlers,
  auth middleware, client, and tests are complete.
- ❌ Do NOT expose request bodies, bearer tokens, or local paths through RPC
  errors or logs.

## Depth

DEEP (0.72). The planned module replaces a large method-to-HTTP translation
surface with one typed contract. Deleting it after implementation would push
method names, payload shapes, success schemas, and error semantics back into
adapters.

## Grill Log

- **Q:** Should the dependency preflight import `@effect/rpc` immediately?
  **A:** No. The package exists in the pnpm store and lockfile but is not linked
  at `node_modules/@effect/rpc` in the current workspace. This slice makes the
  dependency explicit and records the SDK grammar; the code slice imports it
  only after the package manager materializes the link.
- **Q:** Should `events.subscribe` be in the first contract slice?
  **A:** Not as a handler. The contract may reserve the tag, but streaming
  implementation waits for a dedicated slice with `RpcSchema.Stream` and
  backpressure tests.

## Referenced by

[[rpc/_MOC]] · [[ADR-0007-effect-rpc-adoption]] · [[Transport]]
