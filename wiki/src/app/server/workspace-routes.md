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

Own the HTTP handlers for workspace listing, workspace work indexes, workspace
aggregate resume reads, and backed workspace mutations. The domain
[[workspace-service]] already persists
`workspace.created` and `workspace.updated` events and now owns the
`workspace.archived` lifecycle transition; this module exposes those backed
behaviors to clients.

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
export const listWorkspaceWork: Effect<
  HttpServerResponse,
  never,
  | WorkUnitService
  | AppConfigTag
  | SessionService
  | HttpServerRequest
  | HttpRouter.RouteContext
>
export const listWorkspaceCheckpoints: Effect<
  HttpServerResponse,
  never,
  | CheckpointService
  | AppConfigTag
  | SessionService
  | HttpServerRequest
  | HttpRouter.RouteContext
>
export const listWorkspaceArtifacts: Effect<
  HttpServerResponse,
  never,
  | ArtifactService
  | AppConfigTag
  | SessionService
  | HttpServerRequest
  | HttpRouter.RouteContext
>
export const listWorkspaceReviews: Effect<
  HttpServerResponse,
  never,
  | ReviewService
  | WorkUnitService
  | AppConfigTag
  | SessionService
  | HttpServerRequest
  | HttpRouter.RouteContext
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
export const archiveWorkspace: Effect<
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
- `GET /v1/workspaces/{workspace_id}/work` → `workspace:read`
- `GET /v1/workspaces/{workspace_id}/checkpoints` → `workspace:read`
- `GET /v1/workspaces/{workspace_id}/artifacts` → `workspace:read`
- `GET /v1/workspaces/{workspace_id}/reviews` → `workspace:read`
- `POST /v1/workspaces` → `workspace:write`, mints a `WorkspaceId`
- `PATCH /v1/workspaces/{workspace_id}` → `workspace:write`, full replacement by id
- `POST /v1/workspaces/{workspace_id}/archive` → `workspace:write`, one-way archive

### Linkage

- **Requires:** [[workspace-service]], [[work-unit-service]],
  [[checkpoint-service]], [[artifact-service]], [[review-service]], [[id-clock]],
  [[route-support]], [[workspace.schema]], [[work-unit.schema]],
  [[checkpoint.schema]], [[artifact.schema]], [[review.schema]]
- **Consumed by:** [[acp-router]]

## Algorithm

`listWorkspaces` authorizes `workspace:read`, delegates to
[[workspace-service]] `list`, and encodes the array response. `listWorkspaceWork`
authorizes `workspace:read`, reads `workspace_id` from the path, delegates to
[[work-unit-service]] `listForWorkspace`, and encodes the current work index for
that workspace. `listWorkspaceCheckpoints`, `listWorkspaceArtifacts`, and
`listWorkspaceReviews` use the same `workspace:read` gate, then delegate to the
owning domain services' `listForWorkspace` methods so route code never scans
storage directly. `createWorkspace` decodes
[[workspace.schema|CreateWorkspacePayload]], mints a `workspace_*` id and
timestamp, resolves the actor through `workspace:write`, and delegates to service
`create`. `updateWorkspace` decodes [[workspace.schema|UpdateWorkspacePayload]],
takes the id from the path, resolves the actor through `workspace:write`, and
delegates to service `update`. `archiveWorkspace` takes the id from the path,
resolves the actor through `workspace:write`, and delegates to service `archive`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT let clients supply a new workspace id on create; the composition root
  mints it.
- ❌ Do NOT duplicate event emission; [[workspace-service]] owns persisted events.
- ❌ Do NOT archive by deleting the workspace record.
- ❌ Do NOT scan raw storage in route code; domain services own workspace
  filtering for work, checkpoints, artifacts, and reviews.

## Depth

DEEP (0.70). The module hides workspace-specific transport decoding, id/clock
minting, and scopes while preserving the service as the state owner.

## Referenced by

[[acp-router]] · [[server/_MOC]]
