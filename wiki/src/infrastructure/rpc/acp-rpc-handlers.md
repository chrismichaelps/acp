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
work command handlers, lease lifecycle commands, and the merged
[[acp-rpc-artifact-handlers]], [[acp-rpc-checkpoint-handlers]],
[[acp-rpc-review-handlers]], and [[acp-rpc-memory-event-handlers]] layers so
native RPC can prove direct domain-service dispatch, auth semantics, typed ACP
errors, id/timestamp minting, conflict handling, evidence handling,
resumability, review gates, recall, event replay, and event emission before
transport replacement begins. With the memory/event vertical merged, every
[[acp-rpc-contract]] request now has a backing handler.

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
  | Rpc.Handler<'work.publish_event'>
  | Rpc.Handler<'lease.request'>
  | Rpc.Handler<'lease.list'>
  | Rpc.Handler<'lease.renew'>
  | Rpc.Handler<'lease.release'>
  | Rpc.Handler<'lease.revoke'>
  | Rpc.Handler<'artifact.create'>
  | Rpc.Handler<'artifact.update'>
  | Rpc.Handler<'artifact.delete'>
  | Rpc.Handler<'artifact.content'>
  | Rpc.Handler<'artifact.list_for_work'>
  | Rpc.Handler<'artifact.list_for_workspace'>
  | Rpc.Handler<'checkpoint.create'>
  | Rpc.Handler<'checkpoint.list_for_work'>
  | Rpc.Handler<'checkpoint.latest_for_work'>
  | Rpc.Handler<'checkpoint.list_for_workspace'>
  | Rpc.Handler<'review.request'>
  | Rpc.Handler<'review.approve'>
  | Rpc.Handler<'review.reject'>
  | Rpc.Handler<'review.request_changes'>
  | Rpc.Handler<'review.cancel'>
  | Rpc.Handler<'review.list_for_work'>
  | Rpc.Handler<'review.list_for_workspace'>
  | Rpc.Handler<'memory.create'>
  | Rpc.Handler<'memory.list'>
  | Rpc.Handler<'events.list'>,
  never,
  | AppConfigTag
  | SessionService
  | WorkerService
  | WorkspaceService
  | WorkUnitService
  | LeaseService
  | ArtifactService
  | CheckpointService
  | ReviewService
  | EventStore
  | IdClock
>
```

## Algorithm

`session.initialize` mirrors [[acp-router]] bootstrap behavior: validate
`protocol_version`, register the worker, derive capabilities from the draft
handshake booleans when the worker did not send an explicit capability list,
mint a high-entropy session bearer credential through [[id-clock]]
`secureToken`, read the timestamp through [[id-clock]], persist the session, and
return the host descriptor and capability flags.

All authorizing handlers check scopes through [[rpc-auth]] `rpcActor` or
`rpcWorkspaceActor`. The former handles host-wide operations and routes whose
tenant must be derived in a later slice. The latter enforces both the action
scope and an explicit workspace id for direct-workspace handlers while still
consuming a middleware-provided `AcpRpcActor` when [[rpc-auth-middleware]] has
already authenticated the request.

`worker.list`, `worker.get`, and `workspace.list` check their read scopes, then
delegate directly to [[worker-service]] or [[workspace-service]]. `worker.get`
maps absence to `not_found` through [[rpc-error]].

Workspace command handlers use `workspace:write`, mint ids/timestamps through
[[id-clock]], and delegate to [[workspace-service]] create/update/archive so the
same workspace events are emitted as REST. Update and archive authorize against
their target `workspace_id`; create remains host-scoped because the workspace id
does not exist until the handler mints it. Work command handlers use their
matching scopes (`work:create`, `workspace:read`, `work:claim`, `work:update`,
`work:publish_event`), call [[work-unit-service]] directly, and append explicit
published work events through [[event-store]]. `work.create` and
`work.list_for_workspace` enforce direct workspace bindings. `work.get`,
`work.claim`, `work.update_state`, and `work.publish_event` use
[[rpc-resource-workspace-auth]] to derive the target workspace from the stored
work unit before read or mutation.

Lease handlers use `lease:create`, `workspace:read`, `lease:renew`,
`lease:release`, and `lease:revoke`, mint request ids/timestamps through
[[id-clock]], and delegate to [[lease-service]] so TTL defaults,
active-resource conflict checks, workspace-scoped readback,
renew/release/revoke transitions, and lease events remain single-sourced in the
domain layer. `lease.request` and `lease.list` enforce direct workspace
bindings. `lease.renew`, `lease.release`, and `lease.revoke` use
[[rpc-resource-workspace-auth]] to derive the target workspace from the stored
lease before mutation. `lease.release` intentionally returns no RPC payload,
matching the existing HTTP `204` behavior.

Artifact handlers live in [[acp-rpc-artifact-handlers]] and merge into this
aggregate layer. They preserve [[artifact-service]] validation, content storage,
external URI, delete, and list semantics.

Checkpoint handlers live in [[acp-rpc-checkpoint-handlers]] and merge into this
aggregate layer. They preserve [[checkpoint-service]] append-only creation,
newest-first list ordering, latest selection, and missing-latest `not_found`
behavior.

Review handlers live in [[acp-rpc-review-handlers]] and merge into this
aggregate layer. They preserve [[review-service]] request, approval, rejection,
request-changes, cancellation, WorkUnit coupling, and workspace-list semantics
while keeping this source file below the 500-line ceiling. None of these
handlers dispatches through [[acp-router]], JSON-RPC command maps, or REST paths.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT bypass [[rpc-auth]] for scoped read handlers.
- ❌ Do NOT route native RPC calls through HTTP or JSON-RPC adapters.
- ❌ Do NOT delete existing JSON-RPC transports from this slice.

## Depth

MEDIUM (0.66). The module is still partial, but it establishes the incremental
`toLayerHandler` pattern for both reads and mutations without forcing a big-bang
transport rewrite.

## Referenced by

[[rpc-index]] · [[acp-rpc-contract]] · [[acp-rpc-handlers.test]] · [[rpc/_MOC]]
