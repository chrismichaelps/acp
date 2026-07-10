---
type: module
path: '@root/src/domain/review-comments/review-comment-service.ts'
fidelity: Active
domain: '[[ReviewComment]]'
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
depth_score: 0.68
depth_status: DEEP
tags: [module, deep]
aliases: [review-comment-service, ReviewCommentService]
---

# Review Comment Service

## Purpose

Own diff-anchored review comment persistence for first-class review gates. A
ReviewComment is a thread-able, stateful remark anchored to a file location and
diff side within a [[Review]], issued by a [[Worker]] and resolvable by the
author or a reviewer. The service stores comments through [[Storage]] using
indexed queries, emits `review_comment.added`, `review_comment.resolved`, and
`review_comment.reopened` [[Event]] records through [[EventStore]], and exposes
comment state transitions (open → resolved → open).

## Interface

```typescript
export interface AddReviewCommentInput {
  readonly id: ReviewCommentId
  readonly payload: AddReviewCommentPayload
  readonly author: WorkerId
  readonly now: Timestamp
}

export interface ReviewCommentServiceApi {
  readonly add: (
    input: AddReviewCommentInput,
  ) => Effect<ReviewComment, StorageError>
  readonly resolve: (
    id: ReviewCommentId,
    actor: WorkerId,
    now: Timestamp,
  ) => Effect<ReviewComment, ReviewCommentTransitionError>
  readonly reopen: (
    id: ReviewCommentId,
    actor: WorkerId,
    now: Timestamp,
  ) => Effect<ReviewComment, ReviewCommentTransitionError>
  readonly get: (
    id: ReviewCommentId,
  ) => Effect<Option<ReviewComment>, StorageError>
  readonly listForReview: (
    reviewId: ReviewId,
  ) => Effect<readonly ReviewComment[], StorageError>
  readonly listForWork: (
    workId: WorkId,
  ) => Effect<readonly ReviewComment[], StorageError>
}
```

## Governance

- Comments are born in `open` state and transition to `resolved` (stamping
  `resolved_at`) or back to `open` via `reopen` (clearing `resolved_at`).
- The caller supplies `ReviewCommentId` and `Timestamp`, following existing
  domain service convention.
- `listForReview` and `listForWork` use indexed queries (via
  `storage.queryBy`) for efficient per-review and per-work filtering.
- Lists are returned oldest-first by `created_at`.
- Every state change persists before emitting the corresponding event.

## Algorithm

1. `add` builds a ReviewComment from the add payload (state: 'open',
   resolved_at: none), saves it, emits `review_comment.added`, and returns
   the stored value.
2. `get` loads one ReviewComment; absence is `Option.none`.
3. `resolve` requires the comment exists and is in `open` state, transitions
   it to `resolved` with resolved_at stamped, saves, emits
   `review_comment.resolved`, and returns the result. Raises
   `InvalidStateTransitionError` if the comment is not open.
4. `reopen` requires the comment is in `resolved` state, transitions it to
   `open` with resolved_at cleared, saves, emits `review_comment.reopened`,
   and returns the result. Raises `InvalidStateTransitionError` if the
   comment is not resolved.
5. `listForReview` queries the indexed `review_id` field and returns oldest-first.
6. `listForWork` queries the indexed `work_id` field and returns oldest-first.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT allow direct mutation of state without going through resolve/reopen.
- ❌ Do NOT permit resolve/reopen to succeed if the current state does not match
  the expected from-state.
- ❌ Do NOT emit review_comment events before storage succeeds.
- ❌ Do NOT stamp resolved_at if reopening (only resolve should set it).

## Depth

DEEP (0.68). The service hides storage collection naming, indexed query
filtering, schema encode/decode, event emission, state validation, and
timestamp stamping behind one domain surface.

## Grill Log

- **Q:** Why oldest-first instead of newest-first for comment lists?
  **A:** Comments in a review thread are best read chronologically to
  follow the discussion thread, so oldest-first preserves conversational order.

- **Q:** Should comments support deletion?
  **A:** No. Comments are part of the audit trail. Resolved comments can be
  reopened, and if a comment should be ignored, a subsequent comment or
  review decision overrides it.

## Referenced by

[[review-comment-index]] · [[review-comments/_MOC]] · [[ReviewComment]] · [[src/_MOC]]
