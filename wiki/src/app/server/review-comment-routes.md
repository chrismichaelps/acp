---
type: module
path: '@root/src/app/server/review-comment-routes.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.64
depth_status: MEDIUM
tags: [module, seam, review-gate, review-comment, auth]
aliases: [review-comment-routes]
---

# Review Comment Routes

## Purpose

Own the HTTP boundary for diff-anchored [[review-comment-service|review
comments]]: add, resolve, reopen, set an external GitHub id, and list by review
or work. All four mutations require `review:collaborate`; reads retain
`workspace:read`. Opaque target authorization is scope-first, target-derived,
and non-enumerating per [[ADR-0013-review-collaboration-permission]].

## Interface

```typescript
export const addReviewComment // POST /v1/reviews/:review_id/comments
export const resolveReviewComment // POST /v1/review-comments/:comment_id/resolve
export const reopenReviewComment // POST /v1/review-comments/:comment_id/reopen
export const setReviewCommentExternalId // POST /v1/review-comments/:comment_id/external-id
export const listReviewComments // GET  /v1/reviews/:review_id/comments
export const listWorkReviewComments // GET  /v1/work/:work_id/review-comments
```

## Algorithm

Every mutation requires `review:collaborate` before opaque target lookup.
`addReviewComment` decodes the payload, resolves the path `review_id` through
[[review-collaboration-auth]] `reviewTarget`, and obtains the persisted review,
work, authorized actor, and bound workspace. A missing or foreign review returns
the same 404 `NotFoundError` envelope.

After target authorization, collect body identity mismatches in this order:
`review_id must match the target review`, `work_id must match the target review
work`, `workspace_id must match the target review workspace`. Any issues produce
the existing 400 `ValidationError` envelope before id/time minting or service
mutation. A valid request mints through [[id-clock]], calls
`ReviewCommentService.add`, and returns the new [[ReviewComment]] at `201`.

Resolve, reopen, and external-id use `reviewCommentTarget`, which scope-checks
first, loads the persisted comment, hides foreign existence as 404, then calls
the matching service mutation and returns `200`. The external-id route remains
the GitHub bridge's internal REST command. The two `GET` routes retain existing
`workspace:read` behavior.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT load a collaboration target before checking the action scope.
- ❌ Do NOT authorize add against the body `workspace_id` or silently rewrite
  identity mismatches.
- ❌ Do NOT return 403 for a foreign opaque review/comment; missing and foreign
  use the identical 404 envelope.
- ❌ Do NOT accept `workspace:write` or `review:respond` as aliases for comment
  mutation.
- ❌ Do NOT mint ids or read the clock before authorization and validation.

## Depth

MEDIUM (0.64). The handlers hide scope ordering, target derivation,
non-enumeration, validation, and service encoding behind one REST surface.

## Grill Log

- **Q:** Which identity is authoritative? **A:** The path review and its loaded
  work/workspace; body disagreement is a deterministic 400. _Rejected:_ trusting
  or silently overwriting tenant fields.
- **Q:** Why scope-check before lookup? **A:** A caller without the action must
  receive the same 403 for every supplied id. _Rejected:_ load-first behavior
  that reveals existence through 404/403 differences.
- **Q:** Why map a foreign existing comment to 404? **A:** Its existence is
  tenant data. _Rejected:_ a redacted 403 whose status remains an oracle.

## Referenced by

[[review-comment-routes.test]] · [[router]] · [[review-comment-service]] ·
[[review-collaboration-auth]] · [[ADR-0013-review-collaboration-permission]] ·
[[server/_MOC]] · [[2026-07-13-review-collaboration-security-design]] ·
[[acp-http-api-reviews]]
