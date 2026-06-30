---
type: module
path: '@root/src/infrastructure/rpc/acp-rpc-server.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.55
depth_status: MEDIUM
tags: [module, medium, rpc, server]
aliases: [acp-rpc-server]
---

# ACP RPC Server

## Purpose

Provide the single dependency-complete server-side layer for the native
`@effect/rpc` surface, so any transport mounts the [[acp-rpc-handlers]] set over
one composition instead of re-wiring domain dependencies per entry point. This
is the server half of the [[ADR-0007-effect-rpc-adoption]] transport stand-up:
the native-handler phase is finished, and this layer is what a real
`RpcServer.layer` HTTP/socket protocol — or today's [[acp-rpc-roundtrip-test]]
`RpcTest` client — runs against.

## Interface

```typescript
export const AcpRpcHandlersLive: Layer<
  Rpc.ToHandler<AcpRpcGroup>,
  never,
  never
>
```

## Algorithm

`AcpRpcHandlersLive` provides `AcpRpcSessionWorkerWorkspaceHandlersLive` with
`AppLive ⊕ IdClockLive`. `AppLive` supplies the storage-backed domain services
(sessions, workers, workspaces, work, leases, artifacts, checkpoints, reviews,
memory, events) and `IdClockLive` supplies id/timestamp minting, so the merged
layer's requirement channel collapses to `never` — it is launch-ready. Handlers
still authorize through the forwarded `options.headers`, so the transport
chosen above this layer never leaks into the domain, preserving the
[[Transport]] "domain never sees HTTP" invariant.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT provide a second `AppLive`/store above this layer — one composition
  keeps the native surface and the HTTP/JSON-RPC surfaces over one state.
- ❌ Do NOT mount transport-specific protocol layers here; this module is
  transport-agnostic. HTTP/socket route wiring belongs in the host seam.

## Depth

MEDIUM (0.55). A composition module, but it fixes the canonical server-side
dependency boundary the typed transport depends on.

## Referenced by

[[acp-rpc-client]] · [[acp-rpc-handlers]] · [[rpc-index]] · [[rpc/_MOC]]
