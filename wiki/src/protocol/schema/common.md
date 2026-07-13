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
export const MemoryKind: Schema.Literal<["note","decision","observation","constraint","handoff","custom"]>
export const ReviewState: Schema.Literal<[…5 states…]>
export const WorkspaceKind: Schema.Literal<[…6 kinds…]>
export const WorkspaceState: Schema.Literal<["active","archived"]>
export const Resource: Schema.Struct<{ kind: ResourceKind; uri: NonEmptyString }>
export const Permission: Schema.Literal<[ // session auth scopes (spec §8)
  "worker:read","workspace:read","workspace:write","work:create","work:claim",
  "event:read","lease:create","work:update","work:publish_event","lease:renew","lease:release",
  "lease:revoke","artifact:create",
  "artifact:update","artifact:delete","checkpoint:create","memory:create","memory:read","review:create",
  "review:collaborate","review:respond","review:approve","review:reject","review:request_changes","review:cancel"]>
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
can be granted independently. Event replay reads use `event:read` because the
append-only workspace timeline may contain sensitive recovery details. Worker
presence reads use `worker:read` because presence is host-scoped registry state,
not workspace event history. Lease lifecycle actions are split into create,
renew, release, and revoke because extending an advisory claim and terminating
one are different operational powers. Review decisions are split from
`review:cancel` because cancellation withdraws a requested gate without creating
a reviewer outcome. Memory actions are split into create/read because recall
data can expose cross-agent context without granting the ability to publish new
handoff records.

Per [[ADR-0013-review-collaboration-permission]], `review:collaborate` isolates
the eight reviewer-evidence mutations from `workspace:write`, while
`review:respond` authorizes only the worker's `grill answer`. Both are additive
to the wire vocabulary but neither is an alias: an older session remains
decodable and is denied the separated action until reinitialized. The literal
vocabulary admits each value independently; [[session.schema]] owns the
permission-array refinement that rejects both in one session.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT redeclare any of these literal unions in a service or transport file.
- ❌ Do NOT widen a literal union to `string`.
- ❌ Do NOT translate `workspace:write`, `review:collaborate`, or
  `review:respond` into one another while decoding a session.
- ❌ Do NOT put combination policy into the individual permission literal; the
  shared [[session.schema]] array owns session-level mutual exclusion.

## Depth

DEEP (0.7). Centralizes the protocol's closed vocabularies; deleting it scatters
duplicated literal lists that would drift out of sync.

## Referenced by

[[work-unit.schema]] · [[work-unit-service]] · [[worker.schema]] ·
[[workspace-routes]] · [[event-routes]] · [[lease.schema]] · [[memory.schema]] ·
[[ADR-0013-review-collaboration-permission]] · [[src/_MOC]] ·
[[2026-07-13-review-collaboration-security-design]]
