---
type: module
path: '@root/src/infrastructure/http/acp-http-api-reviews.ts'
fidelity: Active
domain: '[[Review]]'
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.61
depth_status: MEDIUM
tags: [module, http, review, grill, contract]
aliases: [acp-http-api-reviews, ReviewCollaborationGroup]
---

# Review HTTP API Contract

## Purpose

Declare the complete typed REST contract for review gates, diff-anchored review
comments, and forced grill adjudication. These operations already exist in
[[acp-router]]; this module makes the production surface visible to
[[acp-http-api]], [[openapi-module]], and generated clients without duplicating
handler behavior.

## Interface

The module exports shared path/payload schemas plus three groups:

```typescript
export const ReviewGroup: HttpApiGroup.HttpApiGroup<'reviews', ...>
export const ReviewCommentGroup: HttpApiGroup.HttpApiGroup<'reviewComments', ...>
export const GrillGroup: HttpApiGroup.HttpApiGroup<'grills', ...>
```

`ReviewGroup` declares request/approve/reject/request-changes/cancel.
`ReviewCommentGroup` declares add/list, resolve/reopen/external-id, and work-level
listing. `GrillGroup` declares open/list/get, question add/answer/verdict, and
evaluation.

## Route Contract

The collaboration slice adds the 13 production operations previously omitted
from the typed declaration:

- `POST` + `GET /v1/reviews/{review_id}/comments`
- `POST /v1/review-comments/{comment_id}/resolve`
- `POST /v1/review-comments/{comment_id}/reopen`
- `POST /v1/review-comments/{comment_id}/external-id`
- `GET /v1/work/{work_id}/review-comments`
- `POST /v1/reviews/{review_id}/grill`
- `GET /v1/reviews/{review_id}/grills`
- `POST /v1/grills/{grill_id}/questions`
- `POST /v1/grills/{grill_id}/evaluate`
- `GET /v1/grills/{grill_id}`
- `POST /v1/grill-questions/{question_id}/answer`
- `POST /v1/grill-questions/{question_id}/verdict`

All payload and success schemas reuse [[review.schema]], [[review-comment.schema]],
and [[grill.schema]]. The external-id body becomes one reusable non-empty string
schema shared with [[review-comment-routes]].

## Negative Logic

- Do not add handler logic or authorization decisions to this module.
- Do not invent routes beyond the production router.
- Do not duplicate inline payload schemas when the handler and contract can share
  one exported schema.
- Do not treat these declarations as a protocol change; they document existing
  additive v0.1 behavior that was already reachable in production.

## Depth

MEDIUM (0.61). The module centralizes one complete review vertical and prevents
the main API declaration from exceeding the file-size boundary while exposing
schemas to generated clients.

## Referenced by

[[acp-http-api]] · [[acp-http-api.test]] · [[openapi-module]] ·
[[review-comment-routes]] · [[grill-routes]] · [[http/_MOC]] ·
[[ADR-0017-openapi-contract-artifact]] · [[2026-07-14-openapi-contract]]
