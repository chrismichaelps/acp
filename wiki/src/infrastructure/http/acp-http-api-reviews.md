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

## Algorithm

1. Define branded path schemas for review, comment, work, grill, and question
   identifiers through `HttpApiSchema.param`.
2. Reuse [[review.schema]], [[review-comment.schema]], and [[grill.schema]] for
   every request and success shape; export the external-id body once for the live
   handler.
3. Group review lifecycle, comment collaboration, and grill adjudication under
   stable operation identifiers without moving handler or authorization logic.
4. Add all three groups to [[acp-http-api]] so the generated contract includes
   every operation already mounted by [[acp-router]].
5. Let [[production-route-inventory-test-support]] compare the resulting typed
   inventory against the live router across the full HTTP method vocabulary.

## Edge Cases

- Comment collection GET and POST share a path but remain separate operations.
- Review respondent and collaborator actions reuse schemas while retaining their
  distinct runtime permission boundaries in [[review-comment-routes]] and
  [[grill-routes]].
- The external-id request accepts a non-empty identifier, while stored legacy
  response data remains compatible with the existing optional string field.
- Declaring these routes is additive contract repair for behavior already live in
  protocol 0.1; it does not create new runtime authority or a version bump.
- Standard 401/403 responses are projected centrally by [[openapi-module]]
  because authorization is implemented outside the typed groups.

## Negative Logic

- Do not add handler logic or authorization decisions to this module.
- Do not invent routes beyond the production router.
- Do not duplicate inline payload schemas when the handler and contract can share
  one exported schema.
- Do not treat these declarations as a protocol change; they document existing
  additive v0.1 behavior that was already reachable in production.

## Grill Log

- **Q:** Why split review groups out of the central API file? **A:** The vertical
  is cohesive and keeps [[acp-http-api]] under the production file-size gate.
  _Rejected:_ allowing the central declaration to become a shallow monolith.
- **Q:** Do typed declarations replace live handlers? **A:** No; they describe
  the existing handler surface for tooling and drift checks. _Rejected:_ moving
  business or authorization logic into the schema module.
- **Q:** Does adding 13 omitted declarations require protocol 0.2? **A:** No;
  clients gain documentation for additive operations already reachable in v0.1.
  _Rejected:_ treating a documentation omission as permission to hide live API.
- **Q:** Can representative routes prove completeness? **A:** No; exact
  full-method production parity is required. _Rejected:_ another partial method
  or path sample.

## Depth

MEDIUM (0.61). The module centralizes one complete review vertical and prevents
the main API declaration from exceeding the file-size boundary while exposing
schemas to generated clients.

## Referenced by

[[acp-http-api]] · [[acp-http-api.test]] · [[openapi-module]] ·
[[review-comment-routes]] · [[grill-routes]] · [[http/_MOC]] ·
[[ADR-0017-openapi-contract-artifact]] · [[2026-07-14-openapi-contract]]
