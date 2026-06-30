---
type: module
path: '@root/src/infrastructure/rpc/acp-rpc-handlers.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.66
depth_status: MEDIUM
tags: [module, medium, rpc]
aliases: [acp-rpc-handlers]
---

# ACP RPC Handlers

## Purpose

Provide the first native `@effect/rpc` handler vertical over
[[acp-rpc-contract]] without replacing existing HTTP, WebSocket, stdio, or
JSON-RPC transports. This slice implements session initialization plus
worker/workspace reads so native RPC can prove direct domain-service dispatch,
auth semantics, and typed ACP errors before high-risk mutations move over.

## Interface

```typescript
export const AcpRpcSessionWorkerWorkspaceHandlersLive: Layer<
  | Rpc.Handler<'session.initialize'>
  | Rpc.Handler<'worker.list'>
  | Rpc.Handler<'worker.get'>
  | Rpc.Handler<'workspace.list'>,
  never,
  AppConfigTag | SessionService | WorkerService | WorkspaceService | IdClock
>
```

## Algorithm

`session.initialize` mirrors [[acp-router]] bootstrap behavior: validate
`protocol_version`, register the worker, derive capabilities from the draft
handshake booleans when the worker did not send an explicit capability list,
mint a session id and timestamp through [[id-clock]], persist the session, and
return the host descriptor and capability flags.

`worker.list`, `worker.get`, and `workspace.list` call [[rpc-auth]] with their
read scopes, then delegate directly to [[worker-service]] or
[[workspace-service]]. `worker.get` maps absence to `not_found` through
[[rpc-error]]. None of these handlers dispatches through [[acp-router]],
JSON-RPC command maps, or REST paths.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT implement mutation handlers in this first vertical.
- ❌ Do NOT bypass [[rpc-auth]] for scoped read handlers.
- ❌ Do NOT route native RPC calls through HTTP or JSON-RPC adapters.
- ❌ Do NOT delete existing JSON-RPC transports from this slice.

## Depth

MEDIUM (0.66). The module is intentionally partial, but it establishes the
incremental `toLayerHandler` pattern that lets native RPC handlers migrate
without a big-bang transport rewrite.

## Referenced by

[[rpc-index]] · [[acp-rpc-contract]] · [[rpc/_MOC]]
