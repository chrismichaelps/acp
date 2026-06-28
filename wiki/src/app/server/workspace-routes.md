---
type: module
path: '@root/src/app/server/workspace-routes.ts'
fidelity: Active
domain: '[[Workspace]]'
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.7
depth_status: DEEP
tags: [module, seam, deep]
aliases: [workspace-routes]
---

# Workspace Routes

## Purpose

Own the HTTP handlers for workspace listing and backed workspace mutations. The
domain [[workspace-service]] already persists `workspace.created` and
`workspace.updated` events; this module exposes that behavior to clients without
adding archive semantics that the [[Workspace]] schema still does not model.

## Interface

### Signatures

```typescript
export const listWorkspaces: Effect<
  HttpServerResponse,
  never,
  WorkspaceService | AppConfigTag | SessionService | HttpServerRequest
>
export const createWorkspace: Effect<
  HttpServerResponse,
  never,
  | WorkspaceService
  | EventStore
  | IdClock
  | AppConfigTag
  | SessionService
  | HttpServerRequest
>
export const updateWorkspace: Effect<
  HttpServerResponse,
  never,
  | WorkspaceService
  | EventStore
  | IdClock
  | AppConfigTag
  | SessionService
  | HttpServerRequest
  | HttpRouter.RouteContext
>
```

### Routes

- `GET /v1/workspaces` → `workspace:read`
- `POST /v1/workspaces` → `workspace:write`, mints a `WorkspaceId`
- `PATCH /v1/workspaces/{workspace_id}` → `workspace:write`, full replacement by id

### Linkage

- **Requires:** [[workspace-service]], [[id-clock]], [[route-support]],
  [[workspace.schema]]
- **Consumed by:** [[acp-router]]

## Algorithm

`listWorkspaces` authorizes `workspace:read`, delegates to
[[workspace-service]] `list`, and encodes the array response. `createWorkspace`
decodes [[workspace.schema|CreateWorkspacePayload]], mints a `workspace_*` id and
timestamp, resolves the actor through `workspace:write`, and delegates to service
`create`. `updateWorkspace` decodes [[workspace.schema|UpdateWorkspacePayload]],
takes the id from the path, resolves the actor through `workspace:write`, and
delegates to service `update`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT implement `workspace.archived` here; archive still lacks persisted state.
- ❌ Do NOT let clients supply a new workspace id on create; the composition root
  mints it.
- ❌ Do NOT duplicate event emission; [[workspace-service]] owns persisted events.

## Depth

DEEP (0.70). The module hides workspace-specific transport decoding, id/clock
minting, and scopes while preserving the service as the state owner.

## Referenced by

[[acp-router]] · [[server/_MOC]]
