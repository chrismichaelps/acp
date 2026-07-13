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
  permissions: SessionPermissions // granted scopes (spec §8)
  workspace_ids: Option.Option<readonly WorkspaceId[]> // ADR-0009 binding
}>
export const SessionPermissions: Schema.filter<readonly Permission[]>
export type Session = typeof Session.Type
```

## Algorithm

Struct over [[ids]] (`SessionId`, `WorkerId`, `WorkspaceId`) + [[common]]
(`Timestamp`, `Permission`). `SessionPermissions` is the shared permission-array
schema used by persisted sessions and every initialization transport. It accepts
either `review:respond` or `review:collaborate`, but rejects an array containing
both with `review:respond and review:collaborate are mutually exclusive`. This
is the per-session invariant from
[[ADR-0013-review-collaboration-permission]]; it does not establish identity
separation across multiple caller-minted sessions.

`workspace_ids` is the ADR-0009 tenant binding: `Option.none` means host-wide
authority for local/single-node deployments; `Option.some([...])` narrows the
session to those workspaces. Persisted by [[session-service]] via the `session`
collection.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT encode workspace ids into permission strings; action permission and
  tenant binding stay separate.
- ❌ Do NOT treat `workspace_ids` as enforcement by itself — route/RPC
  authorization must check it once the target workspace is known.
- ❌ Do NOT allow one session record to carry both response and collaboration
  scopes.
- ❌ Do NOT describe the array refinement as trusted identity issuance; that is
  the separate [[ADR-0015-trusted-session-issuance]] backlog.

## Depth

SHALLOW (0.4). A pure data shape; the actor-resolution behavior lives in
[[session-service]].

## Referenced by

[[session-service]] · [[schema/index]] · [[acp-http-api]] · [[src/_MOC]] ·
[[ADR-0013-review-collaboration-permission]]
