---
type: module
path: '@root/src/app/server/native-rpc-route.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.55
depth_status: MEDIUM
tags: [module, rpc, transport]
aliases: [native-rpc-route]
---

# Native RPC Route

## Purpose

Mount the first-party `@effect/rpc` surface on the running host without
disturbing the existing REST, `POST /rpc` JSON-RPC, or `GET /rpc` WebSocket
routes. This module is the server-side transport seam for
[[ADR-0007-effect-rpc-adoption]]: native Effect/TypeScript clients can now reach
[[acp-rpc-contract]] over real HTTP at `/rpc/native`, while the older protocol
adapters stay available during migration.

## Interface

```typescript
export const nativeRpcPath = '/rpc/native'
export const AcpNativeRpcRouteLive: Layer<never, never, ...>
export const AcpHttpRoutesLive: Layer<never, never, ...>
```

## Algorithm

`nativeRpcPath` is exported as [[acp-rpc-client]] `acpNativeRpcPath`, so server
mounting and first-party client URL construction share one path literal.
`AcpNativeRpcRouteLive` registers `RpcServer.layerHttpRouter` for
[[acp-rpc-contract]] at that path with HTTP protocol framing and NDJSON
serialization. NDJSON framing keeps unary operations and stream chunks on the
same route, which is required for native `events.subscribe`. The route provides
[[acp-rpc-server]] `AcpRpcHandlersLayer`, not the dependency-complete
`AcpRpcHandlersLive`, so the host composition can provide one shared
`AppLive ⊕ IdClockLive` above every transport. That detail is what keeps
sessions, workspaces, events, and memory visible across REST, legacy JSON-RPC,
WebSocket JSON-RPC, and native RPC inside one running host.

The live route regression now covers five socket-sensitive behaviors: typed
workspace creation sharing state with REST, streaming `events.subscribe` over
NDJSON, work/lease lifecycle round-trips, artifact/checkpoint round-trips that
write and read evidence through the mounted route, plus review approval, memory
persistence, and unary event listing. These paths prove more than reachability;
they exercise schema decoding, bearer-session scoping through [[acp-rpc-client]]
helpers, authenticated writes, persisted content reads, state-machine
transitions, lease lifecycle transitions, and checkpoint latest-selection across
the real HTTP client protocol.

`AcpHttpRoutesLive` also mounts [[acp-router]] for `/v1/*` and `/rpc`. The
explicit paths avoid catch-all route ordering ambiguity and leave `/rpc/native`
owned by the native RPC transport.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT mount native RPC through `AcpRpcHandlersLive` inside the host; that
  would allocate a second application graph and split transport state.
- ❌ Do NOT delete the JSON-RPC routes here. Migration from the hand-mapped
  command layer should happen only after the native HTTP route has exercised real
  clients across unary and streaming operations.
- ❌ Do NOT add domain behavior here. The route owns transport registration; the
  handlers remain in [[acp-rpc-handlers]] and its split verticals.

## Depth

MEDIUM (0.55). Thin composition code, but it protects the host's shared-state
invariant at the point where two router implementations meet.

## Referenced by

[[http-app]] · [[server-index]] · [[acp-rpc-server]] · [[Transport]]
