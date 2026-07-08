---
type: module
path: '@root/src/app/server/review-routes.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.55
depth_status: MEDIUM
tags: [module, seam, review]
aliases: [review-routes]
---

# Review Routes

## Purpose

The HTTP handlers for the [[Review]] lifecycle mutations: `POST /v1/reviews`,
`approve`, `reject`, `request_changes`, and `cancel`. Extracted from the
near-limit [[router]] central file (to keep it under the 500-line gate when the
[[review-comment-routes]] and [[grill-routes]] gate handlers landed), each is the
canonical decode → [[review-service]] → encode transport boundary behind the
`review:*` scopes.

## Interface

```typescript
export const requestReview // POST /v1/reviews
export const approveReview // POST /v1/reviews/:review_id/approve
export const rejectReview // POST /v1/reviews/:review_id/reject
export const requestReviewChanges // POST /v1/reviews/:review_id/request_changes
export const cancelReview // POST /v1/reviews/:review_id/cancel
```

## Algorithm

`requestReview` decodes `RequestReviewPayload`, mints a `review` id + `now`,
authorizes `review:create` via [[resource-workspace-auth]] `reviewRequest`
(work → workspace), and encodes the new [[Review]] at `201` — `ReviewService`
itself drives the `running → needs_review` work transition. The four decision
handlers resolve workspace + actor via `resource-workspace-auth` `review`
(review → work → workspace) under the matching `review:*` scope, call the
corresponding `ReviewService` method, and encode the mutated review at `200`.
`approveReview` additionally decodes `ApproveReviewPayload` and threads
`met_requirements` plus an optional `approval_signature`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT transition the work unit here — `ReviewService.request` owns the
  `needs_review` transition.
- ❌ Do NOT embed review state-machine rules — they live in [[review-service]].
- ❌ Do NOT mint ids or read the clock outside [[id-clock]].

## Depth

MEDIUM (0.55). Thin transport handlers carrying the `review:*` scope gates and
the review→work→workspace authorization hop.

## Grill Log

- **Q:** Why was this module split out of [[router]] rather than left inline?
  **A:** Registering the review-comment and grill gate routes pushed `router.ts`
  to 536 lines, past the 500-line file-size gate. The review lifecycle handlers
  were the most cohesive extractable block and already mirror the sibling
  [[resume-routes]]/[[memory-routes]] pattern, so moving them restores headroom
  without changing behavior. _Rejected:_ raising the file-size limit.

- **Q:** Why doesn't `requestReview` transition the work to `needs_review`?
  **A:** `ReviewService.request` owns that transition (running → needs_review);
  duplicating it here would double-fire the work state machine and its events.

## Referenced by

[[router]] · [[review-service]] · [[resource-workspace-auth]] · [[server/_MOC]]
