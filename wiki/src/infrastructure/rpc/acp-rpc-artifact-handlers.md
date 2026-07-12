---
type: module
path: '@root/src/infrastructure/rpc/acp-rpc-artifact-handlers.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.66
depth_status: MEDIUM
tags: [module, medium, rpc, artifact]
aliases: [acp-rpc-artifact-handlers]
---

# ACP RPC Artifact Handlers

## Purpose

Own the native `@effect/rpc` artifact handler vertical without growing
[[acp-rpc-handlers]] past the source-size guard. The module keeps artifact
evidence behavior single-sourced in [[artifact-service]] while exposing direct
handlers for creation, updates, deletion, content reads, and work/workspace
artifact listing.

## Interface

```typescript
export const AcpRpcArtifactHandlersLive: Layer<
  | Rpc.Handler<'artifact.create'>
  | Rpc.Handler<'artifact.update'>
  | Rpc.Handler<'artifact.delete'>
  | Rpc.Handler<'artifact.content'>
  | Rpc.Handler<'artifact.list_for_work'>
  | Rpc.Handler<'artifact.list_for_workspace'>,
  never,
  ArtifactService | WorkUnitService | IdClock
>
```

## Algorithm

Handlers authorize through [[rpc-auth]] `rpcActor` or `rpcWorkspaceActor`,
consuming an `AcpRpcActor` provided by native RPC middleware when available and
falling back to bearer headers for direct `accessHandler` tests. `artifact.create`
checks both `artifact:create` and the payload workspace binding before minting an
id/timestamp through [[id-clock]] and delegating to [[artifact-service]]. That
preserves content-size validation, host-stored `acp://artifacts/{id}` content,
external URI references, and artifact lifecycle events.

By-id update, delete, and content handlers authorize through
[[rpc-resource-workspace-auth]], which loads the stored artifact, derives its
workspace id, and then applies the requested permission. Work-scoped reads use
the same helper through the parent work id. `artifact.content` still returns
`not_found` for external or deleted content after the workspace check passes.
`artifact.list_for_workspace` uses `rpcWorkspaceActor` directly against its
explicit `workspace_id`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT inline artifact storage/content rules in RPC handlers.
- ❌ Do NOT return external artifact URIs from `artifact.content`.
- ❌ Do NOT authorize by-id artifact routes from permission alone; derive the
  stored artifact workspace first.
- ❌ Do NOT dispatch through HTTP, JSON-RPC, stdio, or WebSocket adapters.

## Depth

MEDIUM (0.66). The module is a thin transport layer, but it protects artifact
evidence semantics and keeps the aggregate native RPC handler module under the
file-size ceiling.

## Referenced by

[[acp-rpc-handlers]] · [[acp-rpc-artifact-handlers.test]] · [[rpc-index]] ·
[[rpc/_MOC]]
