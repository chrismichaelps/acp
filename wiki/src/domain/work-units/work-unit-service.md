---
type: module
path: '@root/src/domain/work-units/work-unit-service.ts'
fidelity: Active
domain: '[[WorkUnit]]'
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
depth_score: 0.76
depth_status: DEEP
tags: [module, deep]
aliases: [work-unit-service, WorkUnitService]
---

# WorkUnit Service

## Purpose

Own the [[WorkUnit]] lifecycle for v0.1: create work, read stored work, list work
inside a [[Workspace]], claim open work, validate state transitions, persist
updates through [[Storage]], and emit state-change [[Event]]s through
[[EventStore]]. Review cancellation can withdraw a `needs_review` gate and return
the WorkUnit to `running`; explicit review outcomes still terminate the gate as
approved, rejected, or changes requested.

## Interface

### Signatures

```typescript
export interface CreateWorkInput {
  readonly id: WorkId
  readonly payload: CreateWorkPayload
  readonly createdBy: WorkerId
  readonly now: Timestamp
}

export interface WorkUnitServiceApi {
  readonly create: (input: CreateWorkInput) => Effect<WorkUnit, StorageError>
  readonly get: (workId: WorkId) => Effect<Option<WorkUnit>, StorageError>
  readonly listForWorkspace: (
    workspaceId: WorkspaceId,
  ) => Effect<readonly WorkUnit[], StorageError>
  readonly claim: (
    workId: WorkId,
    workerId: WorkerId,
    now: Timestamp,
  ) => Effect<
    WorkUnit,
    | NotFoundError
    | ClaimConflictError
    | InvalidStateTransitionError
    | StorageError
  >
  readonly transition: (
    workId: WorkId,
    to: WorkState,
    actor: WorkerId,
    now: Timestamp,
  ) => Effect<
    WorkUnit,
    NotFoundError | InvalidStateTransitionError | StorageError
  >
}

export class WorkUnitService extends Context.Tag('WorkUnitService')<
  WorkUnitService,
  WorkUnitServiceApi
>() {}
export const WorkUnitServiceLive: Layer.Layer<
  WorkUnitService,
  never,
  Storage | EventStore
>
```

### Governance

- ID and clock generation are not owned here yet; callers pass `WorkId`,
  `createdBy`, and `Timestamp` until dedicated seams exist.
- Work records are schema-encoded before storage and schema-decoded after reads,
  so `Option` fields never leak as raw JSON inside the service.
- Claim contention on already assigned work fails with `ClaimConflictError`.
  Other invalid transitions fail with `InvalidStateTransitionError`; missing work
  fails with `NotFoundError`.

### Linkage

- **Requires:** [[storage]], [[event-store]], [[work-unit.schema]], [[common]],
  [[protocol-error]]
- **Consumed by:** future HTTP transport, CLI client, and review/workflow services.

## Algorithm

1. `create` builds an `open` WorkUnit, defaults absent priority to `normal`,
   saves it, then emits `work.created`.
2. `claim` loads the WorkUnit. Already assigned work fails with
   `ClaimConflictError`; otherwise the service validates `open -> claimed`, sets
   `assigned_to`, saves it, then emits `work.claimed`.
3. `transition` validates the current state against the state-machine table,
   saves the updated state, and emits the corresponding work/review event.
4. `get` returns `Option.none` for absence and decodes stored records through
   [[work-unit.schema]] for drift protection.
5. `listForWorkspace` decodes stored records and filters by `workspace_id`,
   returning the current metadata index for workspace discoverability.

## State Machine

Allowed transitions:

```text
open -> claimed | cancelled
claimed -> running | cancelled
running -> blocked | needs_review | cancelled
blocked -> running
needs_review -> running | approved | rejected | changes_requested
changes_requested -> running
approved -> completed
```

`changes_requested` is included in [[common]] `WorkState` because spec §14 includes
the transition path even though spec §10.3 omitted it from the prose list.
`needs_review -> running` is reserved for [[review-service]] cancellation; the
transition emits `work.unblocked` because the review gate has been withdrawn
without creating a reviewer outcome.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT mutate work state outside this service.
- ❌ Do NOT write raw undecoded objects into the WorkUnit collection.
- ❌ Do NOT emit events before a state change is persisted.
- ❌ Do NOT generate IDs or timestamps here until those seams exist.
- ❌ Do NOT make transport adapters scan raw storage for work indexes; this
  service owns the filter.

## Depth

DEEP (0.76). The service hides lifecycle validation, storage encoding, assignment,
and event emission behind four methods. Deleting it would scatter state-machine
rules across every transport and workflow caller.

## Referenced by

[[work-unit-service-index]] · [[WorkUnit]] · [[src/_MOC]]
