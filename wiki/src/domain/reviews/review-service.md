---
type: module
path: '@root/src/domain/reviews/review-service.ts'
fidelity: Active
domain: '[[Review]]'
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
depth_score: 0.76
depth_status: DEEP
tags: [module, deep]
aliases: [review-service, ReviewService]
---

# Review Service

## Purpose

Own [[Review]] gates for v0.1. A Review is the protocol's human-in-the-loop
primitive for a [[WorkUnit]]. The service stores review records through
[[Storage]], emits `review.*` [[Event]] records through [[EventStore]], and uses
[[work-unit-service]] to move the related WorkUnit into `needs_review`,
`approved`, `rejected`, or `changes_requested`.

## Interface

```typescript
export interface RequestReviewInput {
  readonly id: ReviewId
  readonly payload: RequestReviewPayload
  readonly now: Timestamp
}

export interface ReviewServiceApi {
  readonly request: (
    input: RequestReviewInput,
  ) => Effect<
    Review,
    NotFoundError | InvalidStateTransitionError | StorageError
  >
  readonly get: (reviewId: ReviewId) => Effect<Option<Review>, StorageError>
  readonly listForWork: (
    workId: WorkId,
  ) => Effect<readonly Review[], StorageError>
  readonly listForWorkspace: (
    workspaceId: WorkspaceId,
  ) => Effect<readonly Review[], StorageError>
  readonly approve: (
    reviewId: ReviewId,
    actor: WorkerId,
    now: Timestamp,
    metRequirements: readonly string[],
  ) => Effect<Review, ReviewServiceError>
  readonly reject: (
    reviewId: ReviewId,
    actor: WorkerId,
    now: Timestamp,
  ) => Effect<
    Review,
    NotFoundError | InvalidStateTransitionError | StorageError
  >
  readonly requestChanges: (
    reviewId: ReviewId,
    actor: WorkerId,
    now: Timestamp,
  ) => Effect<
    Review,
    NotFoundError | InvalidStateTransitionError | StorageError
  >
}
```

## Governance

- Review records do not carry `workspace_id`; the service resolves workspace scope
  from [[work-unit-service]] before emitting events.
- `request` requires the WorkUnit to be in a state that can move to
  `needs_review`.
- `approve` requires every review requirement to be present in `metRequirements`.
- Cancel is deferred because [[event.schema]] has no `review.cancelled` event type.

## Algorithm

1. `request` loads the WorkUnit, saves a `requested` Review, emits
   `review.requested`, and transitions the WorkUnit to `needs_review`.
2. `approve` checks requirements, saves `approved`, emits `review.approved`, and
   transitions the WorkUnit to `approved`.
3. `reject` saves `rejected`, emits `review.rejected`, and transitions the
   WorkUnit to `rejected`.
4. `requestChanges` saves `changes_requested`, emits `review.changes_requested`,
   and transitions the WorkUnit to `changes_requested`.
5. `listForWorkspace` resolves each review's WorkUnit to filter by workspace.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT approve with unmet requirements.
- ❌ Do NOT invent `review.cancelled` until [[event.schema]] includes it.
- ❌ Do NOT emit review events without a WorkUnit-derived workspace scope.

## Depth

DEEP (0.76). The service hides review storage, workspace resolution, requirement
validation, event emission, and WorkUnit outcome coupling behind one domain API.

## Grill Log

- **Q:** Should ReviewService update WorkUnit state?
  **A:** Yes. The domain page states review outcomes affect WorkUnit state, and
  [[work-unit-service]] already owns the legal transition table.
- **Q:** Should cancel ship in this slice?
  **A:** No. The Review schema has `cancelled`, but the Event schema has no
  `review.cancelled` event type. Shipping cancel silently would break the
  append-only event contract.

## Referenced by

[[reviews/_MOC]] · [[Review]] · [[src/_MOC]]
