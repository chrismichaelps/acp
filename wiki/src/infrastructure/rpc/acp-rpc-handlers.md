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

Provide native `@effect/rpc` handler verticals over [[acp-rpc-contract]] without
replacing existing HTTP, WebSocket, stdio, or JSON-RPC transports. The module now
implements session initialization, worker/workspace reads, workspace mutations,
and work command handlers so native RPC can prove direct domain-service
dispatch, auth semantics, typed ACP errors, id/timestamp minting, and event
emission before transport replacement begins.

## Interface

```typescript
export const AcpRpcSessionWorkerWorkspaceHandlersLive: Layer<
  | Rpc.Handler<'session.initialize'>
  | Rpc.Handler<'worker.list'>
  | Rpc.Handler<'worker.get'>
  | Rpc.Handler<'workspace.list'>
  | Rpc.Handler<'workspace.create'>
  | Rpc.Handler<'workspace.update'>
  | Rpc.Handler<'workspace.archive'>
  | Rpc.Handler<'work.create'>
  | Rpc.Handler<'work.list_for_workspace'>
  | Rpc.Handler<'work.get'>
  | Rpc.Handler<'work.claim'>
  | Rpc.Handler<'work.update_state'>
  | Rpc.Handler<'work.publish_event'>,
  never,
  | AppConfigTag
  | SessionService
  | WorkerService
  | WorkspaceService
  | WorkUnitService
  | EventStore
  | IdClock
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
[[rpc-error]].

Workspace command handlers use `workspace:write`, mint ids/timestamps through
[[id-clock]], and delegate to [[workspace-service]] create/update/archive so the
same workspace events are emitted as REST. Work command handlers use their
matching scopes (`work:create`, `workspace:read`, `work:claim`, `work:update`,
`work:publish_event`), call [[work-unit-service]] directly, and append explicit
published work events through [[event-store]]. None of these handlers dispatches
through [[acp-router]], JSON-RPC command maps, or REST paths.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT bypass [[rpc-auth]] for scoped read handlers.
- ❌ Do NOT route native RPC calls through HTTP or JSON-RPC adapters.
- ❌ Do NOT delete existing JSON-RPC transports from this slice.

## Depth

MEDIUM (0.66). The module is still partial, but it establishes the incremental
`toLayerHandler` pattern for both reads and mutations without forcing a big-bang
transport rewrite.

## Referenced by

[[rpc-index]] · [[acp-rpc-contract]] · [[rpc/_MOC]]
