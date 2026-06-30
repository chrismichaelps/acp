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

Provide the canonical server-side handler composition for the native
`@effect/rpc` surface. The module exposes a host-shared handler layer for real
route mounting and a dependency-complete live layer for standalone transports
and focused round-trip tests. This is the server half of the
[[ADR-0007-effect-rpc-adoption]] transport stand-up: the native-handler phase is
finished, and [[native-rpc-route]] now mounts the same handler set over real HTTP.

## Interface

```typescript
export const AcpRpcHandlersLive: Layer<Rpc.ToHandler<AcpRpcGroup>, never, never>

export const AcpRpcHandlersLayer: Layer<
  Rpc.ToHandler<AcpRpcGroup>,
  never,
  AppLive | IdClock
>
```

## Algorithm

`AcpRpcHandlersLayer` is the raw merged handler set. It still requires the
application services and [[id-clock]], which is exactly what the host needs:
[[http-app]] can provide one memoized `AppLive ⊕ IdClockLive` above REST, legacy
JSON-RPC, WebSocket JSON-RPC, native RPC, and the sweeper.

`AcpRpcHandlersLive` provides that handler layer with `AppLive ⊕ IdClockLive`.
It is dependency-complete and launch-ready for isolated transports such as
[[acp-rpc-roundtrip-test]], where there is no surrounding host composition to
share. Handlers still authorize through forwarded `options.headers`, so the
transport chosen above this layer never leaks into the domain, preserving the
[[Transport]] "domain never sees HTTP" invariant.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT mount the dependency-complete `AcpRpcHandlersLive` inside [[http-app]]
  or [[native-rpc-route]] — that would allocate a second application graph and
  split transport state.
- ❌ Do NOT mount transport-specific protocol layers here; this module is
  transport-agnostic. HTTP/socket route wiring belongs in the host seam.

## Depth

MEDIUM (0.55). A composition module, but it fixes the canonical server-side
dependency boundary the typed transport depends on.

## Referenced by

[[acp-rpc-client]] · [[acp-rpc-handlers]] · [[native-rpc-route]] ·
[[rpc-index]] · [[rpc/_MOC]]
