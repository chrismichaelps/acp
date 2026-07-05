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
`approved`, `rejected`, `changes_requested`, or back to `running` when a
requested review is cancelled.

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
    signature: Option<ReviewApprovalSignature>,
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
  readonly cancel: (
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
- `approve` may attach optional signed-approval evidence to the Review and
  `review.approved` event. The service stores the evidence as supplied; it does
  not perform cryptographic verification.
- `cancel` is only valid for a `requested` Review. It emits `review.cancelled`
  and returns the WorkUnit to `running`, preserving the distinction between a
  withdrawn gate and an explicit review outcome.

## Algorithm

1. `request` loads the WorkUnit, saves a `requested` Review, emits
   `review.requested`, and transitions the WorkUnit to `needs_review`.
2. `approve` checks requirements, saves `approved` with optional
   `approval_signature`, emits `review.approved` with the same evidence, and
   transitions the WorkUnit to `approved`.
3. `reject` saves `rejected`, emits `review.rejected`, and transitions the
   WorkUnit to `rejected`.
4. `requestChanges` saves `changes_requested`, emits `review.changes_requested`,
   and transitions the WorkUnit to `changes_requested`.
5. `cancel` saves `cancelled`, emits `review.cancelled`, and transitions the
   WorkUnit back to `running`.
6. `listForWorkspace` resolves each review's WorkUnit to filter by workspace.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT approve with unmet requirements.
- ❌ Do NOT claim an approval signature was verified; this service records
  durable evidence only.
- ❌ Do NOT represent a cancelled review as `review.rejected`.
- ❌ Do NOT emit review events without a WorkUnit-derived workspace scope.

## Depth

DEEP (0.76). The service hides review storage, workspace resolution, requirement
validation, optional signature evidence persistence, event emission, and WorkUnit
outcome coupling behind one domain API.

## Grill Log

- **Q:** Should ReviewService update WorkUnit state?
  **A:** Yes. The domain page states review outcomes affect WorkUnit state, and
  [[work-unit-service]] already owns the legal transition table.
- **Q:** Should cancel ship in this slice?
  **A:** Yes. [[event.schema]] now carries `review.cancelled`, so cancellation can
  be represented as its own append-only event instead of being forced through a
  false reviewer outcome.
- **Q:** Should signed approvals verify cryptographic signatures now?
  **A:** No. The v0.1 host records signature evidence supplied by the reviewer,
  but verification needs a separate trust/key seam. _Rejected:_ adding ad hoc
  crypto verification inside [[review-service]], which would blur domain state
  transitions with key management and algorithm policy.

## Referenced by

[[reviews/_MOC]] · [[Review]] · [[src/_MOC]]
