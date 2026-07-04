---
type: module
path: '@root/src/infrastructure/rpc/acp-rpc-checkpoint-handlers.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.66
depth_status: MEDIUM
tags: [module, medium, rpc, checkpoint]
aliases: [acp-rpc-checkpoint-handlers]
---

# ACP RPC Checkpoint Handlers

## Purpose

Own the native `@effect/rpc` checkpoint handler vertical without expanding
[[acp-rpc-handlers]] into another near-limit module. The module keeps append-only
resume-point behavior single-sourced in [[checkpoint-service]] while exposing
direct handlers for creation, work/workspace lists, and latest checkpoint reads.

## Interface

```typescript
export const AcpRpcCheckpointHandlersLive: Layer<
  | Rpc.Handler<'checkpoint.create'>
  | Rpc.Handler<'checkpoint.list_for_work'>
  | Rpc.Handler<'checkpoint.latest_for_work'>
  | Rpc.Handler<'checkpoint.list_for_workspace'>,
  never,
  CheckpointService | WorkUnitService | IdClock
>
```

## Algorithm

Handlers authorize through [[rpc-auth]] `rpcActor` or `rpcWorkspaceActor`, which
consume a middleware-provided `AcpRpcActor` when [[rpc-auth-middleware]] has
already authenticated the request and fall back to bearer headers for direct
`accessHandler` tests. `checkpoint.create` checks both `checkpoint:create` and
the payload workspace binding, mints an id and timestamp through [[id-clock]],
and delegates to [[checkpoint-service]] so append-only persistence and
`checkpoint.created` event emission remain domain-owned.

Read handlers check `workspace:read` through the same bridge. Work-scoped
reads first prove the WorkUnit exists through [[work-unit-service]], matching
the HTTP resume route. `checkpoint.list_for_work` and
`checkpoint.list_for_workspace` preserve newest-first ordering from
[[checkpoint-service]]; the workspace list also checks the explicit
`workspace_id` binding through `rpcWorkspaceActor`. `checkpoint.latest_for_work`
maps an empty checkpoint history to `not_found`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT update, overwrite, or delete checkpoints from RPC.
- ❌ Do NOT compute latest ordering inside the handler.
- ❌ Do NOT dispatch through HTTP, JSON-RPC, stdio, or WebSocket adapters.

## Depth

MEDIUM (0.66). The module is intentionally thin, but it protects resumability
semantics while keeping the aggregate native RPC handler module below the
file-size ceiling.

## Referenced by

[[acp-rpc-handlers]] · [[rpc-index]] · [[rpc/_MOC]]
