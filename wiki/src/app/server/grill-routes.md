---
type: module
path: '@root/src/app/server/grill-routes.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.64
depth_status: MEDIUM
tags: [module, seam, review-gate, grill]
aliases: [grill-routes]
---

# Grill Routes

## Purpose

The HTTP handlers for the forced senior-question review gate
([[grill-service]]): open a grill, ask/answer/decide questions, evaluate the
gate, and read grill state. Split out of the near-limit [[router]] central file,
each handler is the canonical decode → [[grill-service]] → encode transport
boundary behind the `workspace:write` / `workspace:read` scopes.

## Interface

```typescript
export const openGrill          // POST /v1/reviews/:review_id/grill
export const addGrillQuestion   // POST /v1/grills/:grill_id/questions
export const answerGrillQuestion// POST /v1/grill-questions/:question_id/answer
export const setGrillVerdict    // POST /v1/grill-questions/:question_id/verdict
export const evaluateGrill      // POST /v1/grills/:grill_id/evaluate
export const getGrill           // GET  /v1/grills/:grill_id
export const listReviewGrills   // GET  /v1/reviews/:review_id/grills
```

## Algorithm

`openGrill` decodes `OpenGrillPayload`, mints a `grill` id + `now`, authorizes
`workspace:write` on the body `workspace_id` (returned worker is `opened_by`),
and encodes the new [[Grill]] at `201`. `addGrillQuestion` resolves the grill's
workspace via [[resource-workspace-auth]] `grill`, mints a `grillquestion` id,
and encodes the [[GrillQuestion]] at `201`. `answerGrillQuestion` /
`setGrillVerdict` resolve workspace via `resource-workspace-auth` `grillQuestion`
(question → parent grill → `workspace_id`), decode `AnswerGrillQuestionPayload` /
`SetGrillVerdictPayload`, and encode the mutated question at `200`.
`evaluateGrill` authorizes `workspace:write` on the grill and returns the
`GrillEvaluation` gate verdict at `200`. `getGrill` authorizes `workspace:read`
and encodes the `{ grill, questions }` [[GrillDetail]] composite at `200`;
`listReviewGrills` authorizes via `review` and encodes the `Grill[]` at `200`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT embed the gate rule (blockers accepted + comments resolved) here —
  it lives in [[grill-service]] `evaluate`.
- ❌ Do NOT authorize question mutations against a body `workspace_id` — a
  [[GrillQuestion]] carries none; walk question → grill → workspace.
- ❌ Do NOT return the bare `Grill` from `getGrill` — the composite `GrillDetail`
  (grill + its questions) is the read contract.
- ❌ Do NOT mint ids or read the clock outside [[id-clock]].

## Depth

MEDIUM (0.64). Thin transport handlers carrying scope gates plus the
question→grill→workspace authorization walk for id-keyed question mutations.

## Referenced by

[[router]] · [[grill-service]] · [[resource-workspace-auth]] · [[server/_MOC]]
