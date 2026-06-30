---
type: module
path: '@root/src/infrastructure/rpc/acp-rpc-contract.ts'
fidelity: Active
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
and typed protocol errors. Secured operations now carry required-scope
annotations consumed by [[rpc-auth-middleware]]. Handler verticals live in
[[acp-rpc-handlers]] and its split modules; native `events.subscribe` now uses
`@effect/rpc` streaming, while JSON-RPC deletion remains a later slice.

## Interface

The source module exports a single `AcpRpcGroup`, an `AcpRpcs` constant registry,
and sorted `acpRpcTags` for contract tests. Each operation uses the current
protocol schemas for payload and success values, and `ProtocolError` as the
typed error envelope so failures keep ACP error codes instead of the JSON-RPC
`-32602`/`-32603` collapse.

```typescript
export const AcpRpcGroup: RpcGroup.RpcGroup<...>
export const AcpRpcs: { readonly ... }
export const acpRpcTags: readonly string[]
```

The group covers workspace, worker, session, work, lease, artifact, checkpoint,
review, event replay, event subscription, and memory operations. `events.list`
returns a replay array; `events.subscribe` is declared with `stream: true` so the
generated client receives an Effect `Stream<Event, ProtocolError>`.

Every secured operation is wrapped by the local `scoped(...)` helper, which
attaches an `AcpRpcRequiredScope` annotation and the `AcpRpcAuthMiddleware`
runtime tag while preserving the existing generated-client type shape.

## Algorithm

Import `Rpc` and `RpcGroup` from `@effect/rpc`. Define one `Rpc.make(tag)` per
ACP operation through the local `rpc(tag)` helper, which attaches
`ProtocolError` to every operation. Read-only operations with path/query
parameters receive payload schemas that name those parameters directly rather
than encoding HTTP paths. Mutations reuse existing payload schemas wherever the
REST body already matches the domain command, and add small parameter payload
schemas only where REST currently carries ids in the path.

Handler modules implement narrow `AcpRpcGroup.toLayerHandler(...)` layers
against domain services, [[id-clock]], and [[rpc-auth]]. Native HTTP execution
also runs [[rpc-auth-middleware]] before the handler. Handlers must call domain
services directly; they must not dispatch through [[acp-router]] or the JSON-RPC
command map.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT route native RPC handlers through REST paths or JSON-RPC envelopes.
- ❌ Do NOT delete [[jsonrpc/_MOC|JSON-RPC]] until the native contract, handlers,
  auth middleware, client, streaming plan, and tests are complete.
- ❌ Do NOT expose request bodies, bearer tokens, or local paths through RPC
  errors or logs.

## Depth

DEEP (0.72). The planned module replaces a large method-to-HTTP translation
surface with one typed contract. Deleting it after implementation would push
method names, payload shapes, success schemas, and error semantics back into
adapters.

## Grill Log

- **Q:** Why use `ProtocolError` rather than all domain error classes directly?
  **A:** It is the current closed ACP wire error envelope and preserves
  low-cardinality error codes immediately. Domain-error unions can replace it
  once the handler layer no longer shares REST error mapping.
- **Q:** Why switch the native HTTP transport to NDJSON?
  **A:** `RpcSerialization.layerJson` is sufficient for unary calls but has no
  frame boundary for incremental chunks. `RpcSerialization.layerNdjson` supports
  both unary requests and streaming `events.subscribe` on `/rpc/native`.

## Referenced by

[[rpc/_MOC]] · [[acp-rpc-handlers]] · [[ADR-0007-effect-rpc-adoption]] ·
[[rpc-auth-middleware]] · [[Transport]]
