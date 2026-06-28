---
type: module
path: '@root/src/protocol/schema/workspace.schema.ts'
fidelity: Active
domain: '[[Workspace]]'
grammar: '[[grammar/typescript]]'
depth_score: 0.55
depth_status: MEDIUM
tags: [module, medium]
aliases: [workspace.schema]
---

# Workspace Schema

## Purpose

Wire + domain shape of a [[Workspace]] (spec §10.2).

## Interface

### Signatures

```typescript
export const Workspace: Schema.Struct<{
  id: WorkspaceId
  name: NonEmptyString
  kind: WorkspaceKind
  uri: NonEmptyString
  state: WorkspaceState // defaults to "active"
  default_branch: optionalWith<string, Option>
  metadata: Schema.Record<string, string>
}>
export type Workspace = typeof Workspace.Type
export const CreateWorkspacePayload: Schema.Struct<{
  name: Workspace['name']
  kind: WorkspaceKind
  uri: Workspace['uri']
  default_branch: Workspace['default_branch']
  metadata: Record<string, string> // defaults to {}
}>
export const UpdateWorkspacePayload = CreateWorkspacePayload
```

## Algorithm

Struct over [[ids]] + [[common]] `WorkspaceKind`. `default_branch` is `Option`
(may be absent for non-Git workspaces). `state` defaults to `active` for older
records and create payloads; `metadata` is an open string map.
`CreateWorkspacePayload` and `UpdateWorkspacePayload` reuse the same public
fields without `id` or `state`; the transport edge mints or reads identity from
the route, and [[workspace-service]] owns archival.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT assume `default_branch` is present — it is `Option` (Git-aware, not Git-dependent).
- ❌ Do NOT let create/update payloads carry `id`; workspace identity belongs to
  the route/composition boundary.
- ❌ Do NOT let create/update payloads carry `state`; archive is a domain
  transition, not a generic field replacement.

## Depth

MEDIUM (0.58). Data shape; Git-neutrality is encoded via optional branch, and
archival now has a persisted lifecycle value instead of a synthetic delete.

## Referenced by

[[workspace-routes]] · [[acp-http-api]] · [[src/_MOC]]
