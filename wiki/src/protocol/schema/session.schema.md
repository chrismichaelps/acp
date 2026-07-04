---
type: module
path: '@root/src/protocol/schema/session.schema.ts'
fidelity: Active
domain: '[[Worker]]'
grammar: '[[grammar/typescript]]'
depth_score: 0.4
depth_status: SHALLOW
tags: [module, shallow]
aliases: [session.schema]
---

# Session Schema

## Purpose

Wire + domain shape of a Session — the record minted at
`POST /v1/session/initialize` (spec §9) that binds a `SessionId` to the
[[Worker]] that opened it. The `id` doubles as the v0.1 bearer token (spec §8).

## Interface

### Signatures

```typescript
export const Session: Schema.Struct<{
  id: SessionId
  worker_id: WorkerId
  created_at: Timestamp
  permissions: Schema.Array<Permission> // granted scopes (spec §8)
  workspace_ids: Option.Option<readonly WorkspaceId[]> // ADR-0009 binding
}>
export type Session = typeof Session.Type
```

## Algorithm

Struct over [[ids]] (`SessionId`, `WorkerId`, `WorkspaceId`) + [[common]]
(`Timestamp`, `Permission`). `permissions` are the spec §8 scopes the session may
exercise. `workspace_ids` is the ADR-0009 tenant binding: `Option.none` means
host-wide authority for local/single-node deployments; `Option.some([...])`
narrows the session to those workspaces. Persisted by [[session-service]] via the
`session` collection.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT encode workspace ids into permission strings; action permission and
  tenant binding stay separate.
- ❌ Do NOT treat `workspace_ids` as enforcement by itself — route/RPC
  authorization must check it once the target workspace is known.

## Depth

SHALLOW (0.4). A pure data shape; the actor-resolution behavior lives in
[[session-service]].

## Referenced by

[[session-service]] · [[schema/index]] · [[src/_MOC]]
