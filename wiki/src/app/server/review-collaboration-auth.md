---
type: module
path: '@root/src/app/server/review-collaboration-auth.ts'
fidelity: Active
domain: '[[Workspace]]'
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.74
depth_status: DEEP
tags: [module, auth, tenancy, review, deep]
aliases: [review-collaboration-auth]
---

# Review Collaboration Auth

## Purpose

Own the scope-first, target-derived, non-enumerating authorization policy for
opaque review comment and grill mutations under
[[ADR-0013-review-collaboration-permission]]. This focused module keeps the
existing 149-line [[resource-workspace-auth]] module stable and satisfies the
FMCF Split Protocol: the new policy is implemented behind a new deep boundary
instead of growing an established supporting helper by more than 15%.

## Interface

```typescript
reviewTarget(scope, reviewId) // review → work → workspace
reviewCommentTarget(scope, commentId) // comment → workspace
grillTarget(scope, grillId) // grill → workspace
grillQuestionTarget(scope, questionId) // question → grill → workspace
```

`scope` is exactly `review:collaborate` or `review:respond`, selected by the
route. Each helper returns the authorized actor plus the persisted resources the
handler needs for identity comparison or mutation.

## Algorithm

Every helper executes one ordered boundary protocol:

1. Call [[route-support]] `authorizeActor(scope)` before storage lookup. Missing
   scope returns the existing 403 envelope for any supplied id.
2. Load the requested resource and any owning review/work or question/grill
   chain. Absence raises `NotFoundError(entity, requestedId)`.
3. Compare the actor's workspace bindings with the derived workspace. Host-wide
   or matching sessions pass. A foreign binding raises the same
   `NotFoundError(entity, requestedId)` as absence, producing an identical 404
   envelope without revealing the owning workspace or parent.
4. Return actor and loaded target only after scope and binding succeed.

The module may reuse service interfaces and the actor/binding primitives from
[[route-support]], but it does not change global error mapping or the established
generic helper behavior in [[resource-workspace-auth]].

## Negative Logic (Prohibited Paths)

- ❌ Do NOT load an opaque collaboration target before checking its action scope.
- ❌ Do NOT return a distinguishable forbidden response for a foreign opaque id.
- ❌ Do NOT authorize from body `workspace_id`, `work_id`, or `review_id` fields.
- ❌ Do NOT duplicate workspace ids onto reviews or grill questions.
- ❌ Do NOT place these four helpers back into [[resource-workspace-auth]].

## Depth

DEEP (0.74). One small API hides multi-hop tenant derivation, ordered scope
checks, and non-enumerating denial from both route families.

## Grill Log

- **Q:** Why create a module for four helpers? **A:** They share a stronger
  authorization contract than the established generic helpers and would grow a
  149-line module beyond FMCF's 15% split threshold. _Rejected:_ silently
  changing every generic helper or adding a policy branch to the legacy module.
- **Q:** Why authorize scope before lookup? **A:** It removes a 403/404 existence
  oracle for callers that lack the action. _Rejected:_ load-first helper reuse.

## Referenced by

[[review-collaboration-auth.test]] · [[review-comment-routes]] ·
[[grill-routes]] · [[resource-workspace-auth]] · [[route-support]] ·
[[ADR-0013-review-collaboration-permission]] · [[server/_MOC]] ·
[[2026-07-13-review-collaboration-security-design]]
