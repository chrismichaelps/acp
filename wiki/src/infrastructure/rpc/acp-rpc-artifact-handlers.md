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

Mutation handlers authorize `artifact:create`, `artifact:update`, or
`artifact:delete`, mint ids/timestamps through [[id-clock]], and delegate to
[[artifact-service]]. That preserves content-size validation, host-stored
`acp://artifacts/{id}` content, external URI references, and artifact lifecycle
events.

Read handlers authorize `workspace:read`. `artifact.content` first proves the
artifact exists, then reads host-stored content and returns `not_found` for
external or deleted content. `artifact.list_for_work` mirrors the HTTP resume
route by proving the WorkUnit exists through [[work-unit-service]] before
listing metadata. `artifact.list_for_workspace` remains a workspace-scoped
collection read.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT inline artifact storage/content rules in RPC handlers.
- ❌ Do NOT return external artifact URIs from `artifact.content`.
- ❌ Do NOT dispatch through HTTP, JSON-RPC, stdio, or WebSocket adapters.

## Depth

MEDIUM (0.66). The module is a thin transport layer, but it protects artifact
evidence semantics and keeps the aggregate native RPC handler module under the
file-size ceiling.

## Referenced by

[[acp-rpc-handlers]] · [[rpc-index]] · [[rpc/_MOC]]
