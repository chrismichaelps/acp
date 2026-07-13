---
type: module
path: '@root/src/app/server/grill-routes.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.68
depth_status: MEDIUM
tags: [module, seam, review-gate, grill, auth]
aliases: [grill-routes]
---

# Grill Routes

## Purpose

Own the HTTP boundary for the forced senior-question review gate
([[grill-service]]). Reviewer construction/adjudication uses
`review:collaborate`; worker answer uses the separate `review:respond` scope.
Reads retain `workspace:read`. Opaque targets are scope-first, target-derived,
and non-enumerating per [[ADR-0013-review-collaboration-permission]].

## Interface

```typescript
export const openGrill // review:collaborate
export const addGrillQuestion // review:collaborate
export const answerGrillQuestion // review:respond
export const setGrillVerdict // review:collaborate
export const evaluateGrill // review:collaborate
export const getGrill // workspace:read
export const listReviewGrills // workspace:read
```

## Algorithm

`openGrill` requires `review:collaborate` before resolving the path review
through [[review-collaboration-auth]] `reviewTarget`. Missing and foreign reviews
return the same 404 envelope. After authorization, it collects body
`review_id`/`work_id`/`workspace_id` mismatches in the same deterministic order
and issue vocabulary as [[review-comment-routes]], returning the existing 400
`ValidationError` envelope before persistence.

`addGrillQuestion`, `setGrillVerdict`, and `evaluateGrill` require
`review:collaborate` and use [[review-collaboration-auth]] `grillTarget` /
`grillQuestionTarget`. `answerGrillQuestion` alone requires `review:respond` and
uses `grillQuestionTarget`. All target helpers check scope before lookup and collapse
missing/foreign ids into the same 404. A respond-only worker cannot verdict or
evaluate; a collaborate-only reviewer cannot answer. `getGrill` and
`listReviewGrills` retain `workspace:read` and existing read contracts.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT authorize worker answer with `review:collaborate`.
- ❌ Do NOT allow `review:respond` to open, ask, verdict, evaluate, or mutate
  comments.
- ❌ Do NOT load an opaque collaboration target before scope authorization.
- ❌ Do NOT return 403 for a foreign review/grill/question; missing and foreign
  use the identical 404 envelope.
- ❌ Do NOT trust or rewrite open-grill body identity.
- ❌ Do NOT accept `workspace:write` as a compatibility alias.

## Depth

MEDIUM (0.68). The handlers enforce per-session response/adjudication scope
separation and hide the question→grill→workspace non-enumerating authorization
walk. Cross-session identity trust remains outside this route boundary.

## Grill Log

- **Q:** What prevents worker self-adjudication? **A:** `grill answer` requires
  `review:respond`; verdict/evaluate require `review:collaborate`, and canonical
  roles never share them. _Rejected:_ one shared scope or relying on convention.
- **Q:** Why derive question scope through its grill? **A:** The parent grill is
  the single tenant owner. _Rejected:_ duplicated question workspace state.
- **Q:** Why does `getGrill` return `GrillDetail`? **A:** A resuming actor needs
  gate and questions together. _Rejected:_ an extra N+1 read.

## Referenced by

[[grill-routes.test]] · [[router]] · [[grill-service]] ·
[[review-collaboration-auth]] · [[ADR-0013-review-collaboration-permission]] ·
[[server/_MOC]] · [[2026-07-13-review-collaboration-security-design]]
