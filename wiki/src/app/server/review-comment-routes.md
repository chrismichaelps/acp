---
type: module
path: '@root/src/app/server/review-comment-routes.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.6
depth_status: MEDIUM
tags: [module, seam, review-gate, review-comment]
aliases: [review-comment-routes]
---

# Review Comment Routes

## Purpose

The HTTP handlers for diff-anchored [[review-comment-service|review comments]]:
`POST /v1/reviews/:review_id/comments`, `POST /v1/review-comments/:comment_id/resolve`,
`POST /v1/review-comments/:comment_id/reopen`, `GET /v1/reviews/:review_id/comments`,
and `GET /v1/work/:work_id/review-comments`. Split out of the near-limit
[[router]] central file, each handler is the canonical decode →
[[review-comment-service]] → encode transport boundary behind the
`workspace:write` / `workspace:read` scopes.

## Interface

```typescript
export const addReviewComment // POST /v1/reviews/:review_id/comments
export const resolveReviewComment // POST /v1/review-comments/:comment_id/resolve
export const reopenReviewComment // POST /v1/review-comments/:comment_id/reopen
export const listReviewComments // GET  /v1/reviews/:review_id/comments
export const listWorkReviewComments // GET  /v1/work/:work_id/review-comments
```

## Algorithm

`addReviewComment` decodes `AddReviewCommentPayload` (which already carries
`review_id`/`work_id`/`workspace_id`/`target`/`body`), mints a `reviewcomment`
id and `now` from [[id-clock]], authorizes `workspace:write` on the body's
`workspace_id` (the returned worker is the comment `author`), then calls
`ReviewCommentService.add` and encodes the new [[ReviewComment]] at `201`.
`resolveReviewComment` / `reopenReviewComment` resolve the comment's workspace
via [[resource-workspace-auth]] `reviewComment` (comment → `workspace_id`), then
call `resolve` / `reopen` and encode at `200`. The two `GET` lists authorize the
parent scope — `listReviewComments` via `resource-workspace-auth` `review`
(review → work → workspace), `listWorkReviewComments` via `work` — then encode
the oldest-first array at `200`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT re-derive `review_id` from the path onto the payload — the body is
  the authoritative `AddReviewCommentPayload`; the path segment only routes.
- ❌ Do NOT embed comment state rules (open→resolved→reopened) here — they live
  in [[review-comment-service]].
- ❌ Do NOT authorize comment/work reads against a body `workspace_id` that is
  absent on `GET`/id-keyed routes — resolve tenant scope from the resource.
- ❌ Do NOT mint ids or read the clock outside [[id-clock]].

## Depth

MEDIUM (0.6). Thin transport handlers carrying the scope gate and the
resource→workspace authorization hop for id-keyed mutations.

## Grill Log

- **Q:** The path carries `:review_id` and the body carries `review_id` too —
  which wins, and why keep both?
  **A:** The body's `AddReviewCommentPayload` is authoritative (the service reads
  `payload.review_id`); the path segment only routes and namespaces the
  collection under the review. They are expected to agree, but the handler never
  copies the path onto the payload — doing so would mask a client mismatch and
  duplicate the single source of truth. _Rejected:_ overwriting
  `body.review_id` with the path param.

- **Q:** Why authorize resolve/reopen through `resource-workspace-auth`
  `reviewComment` instead of a body `workspace_id` like add does?
  **A:** Those routes are keyed only by `comment_id` with no body — the tenant
  scope must be derived from the loaded comment, and 404 (not 403) is returned
  for a missing comment before authorization can even name a workspace.

## Referenced by

[[review-comment-routes.test]] · [[router]] · [[review-comment-service]] ·
[[resource-workspace-auth]] · [[server/_MOC]]
