---
type: module
path: '@root/src/protocol/schema/common.ts'
fidelity: Active
domain: '[[WorkUnit]]'
grammar: '[[grammar/typescript]]'
depth_score: 0.7
depth_status: DEEP
tags: [module, deep]
aliases: [common, common-schema]
---

# Common Schema (shared value objects)

## Purpose

Shared literal enums and small value objects used across multiple entity schemas:
`Timestamp`, `Priority`, and the closed literal unions for each entity's `state`/
`kind`/`status`. Single source of truth for the allowed-value lists in spec §10.

## Interface

### Signatures

```typescript
export const Timestamp: Schema.brand<…, "Timestamp">   // ISO-8601 string, branded
export const Priority: Schema.Literal<["low","normal","high","urgent"]>
export const WorkerKind: Schema.Literal<["human","agent","bot","ci","system"]>
export const WorkerStatus: Schema.Literal<["online","idle","busy","blocked","offline"]>
export const WorkState: Schema.Literal<[…10 states including "changes_requested"…]>
export const LeaseState: Schema.Literal<["active","expired","released","revoked"]>
export const ResourceKind: Schema.Literal<[…8 kinds…]>
export const ArtifactKind: Schema.Literal<[…11 kinds…]>
export const ReviewState: Schema.Literal<[…5 states…]>
export const WorkspaceKind: Schema.Literal<[…6 kinds…]>
export const WorkspaceState: Schema.Literal<["active","archived"]>
export const Resource: Schema.Struct<{ kind: ResourceKind; uri: NonEmptyString }>
export const Permission: Schema.Literal<[ // session auth scopes (spec §8)
  "worker:read","workspace:read","workspace:write","work:create","work:claim",
  "lease:create","work:update","work:publish_event","lease:renew","lease:release",
  "lease:revoke","artifact:create",
  "artifact:update","artifact:delete","checkpoint:create","review:create",
  "review:approve","review:reject","review:request_changes"]>
```

## Algorithm

Each enum is `Schema.Literal(...members)` matching the spec state vocabularies.
`WorkState` includes `changes_requested` from spec §14's state machine; spec §10.3
omits it from the prose list, but services follow the transition table. Services
import these unions, never re-declare them. `WorkspaceState` is the persisted
lifecycle backing for `workspace.archived`: workspaces default to `active` and
move one-way to `archived`.

`Permission` is the closed bearer-session authorization vocabulary. It includes
both draft create scopes and the backed mutation/action scopes used by
[[acp-router]] so read surfaces, destructive actions, and review-outcome commands
can be granted independently. Worker presence reads use `worker:read` because
presence is host-scoped registry state, not workspace event history. Lease
lifecycle actions are split into create, renew, release, and revoke because
extending an advisory claim and terminating one are different operational powers.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT redeclare any of these literal unions in a service or transport file.
- ❌ Do NOT widen a literal union to `string`.

## Depth

DEEP (0.7). Centralizes the protocol's closed vocabularies; deleting it scatters
duplicated literal lists that would drift out of sync.

## Referenced by

[[work-unit.schema]] · [[work-unit-service]] · [[worker.schema]] ·
[[workspace-routes]] · [[lease.schema]] · [[src/_MOC]]
