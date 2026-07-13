---
type: module
path: '@root/src/app/server/grill-routes.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, server, grill, review-gate]
aliases: [grill-routes.test]
---

# Grill Route Tests

## Purpose

Prove [[grill-routes]] projects the complete senior-question gate through public
HTTP while enforcing responder/adjudicator separation and non-enumerating,
target-derived workspace binding across all five grill mutations.

## Interface

Vitest integration suite over the in-process [[acp-router]] with a scoped
review-capable worker.

## Algorithm

Create, claim, and run work; request review; then use a bound
`review:collaborate` reviewer to open/ask and a separate bound
`review:respond` worker to answer. The worker must receive exact 403 denials on
open, ask, verdict, evaluate, and every comment mutation; the reviewer must
receive 403 on answer. Only the reviewer records verdict/evaluates, and the final
gate passes.

For all five mutations, `workspace:write` without the new action permission is 403. A missing-scope token receives 403 for any id. Correctly scoped missing and
foreign review/grill/question ids return byte-equivalent 404 envelopes. Open
body identity mismatches return the exact 400 envelope and deterministic issue
strings before persistence.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT pass while a blocker remains pending, unanswered, or rejected.
- ❌ Do NOT return a bare grill from the detail route.
- ❌ Do NOT omit a newly opened grill from its review-scoped list.
- ❌ Do NOT decide the gate inside route code; the service owns evaluation.
- ❌ Do NOT omit worker-authenticated `grill answer`; it proves the canonical
  worker bootstrap can satisfy a blocker.
- ❌ Do NOT give that worker `review:collaborate`; the regression must prove it
  cannot verdict or evaluate its own answer.
- ❌ Do NOT give the reviewer `review:respond`; adjudicators cannot answer on the
  worker's behalf.
- ❌ Do NOT let `workspace:write` pass as a legacy alias on any of the five
  mutation handlers.
- ❌ Do NOT trust an open-grill payload as cross-workspace evidence.
- ❌ Do NOT return 403 for an existing foreign opaque target.

## Grill Log

- **Q:** Is an accepted verdict enough evidence? **A:** No. The suite separately
  calls evaluate and pins the resulting gate state and blocking list. _Rejected:_
  treating question mutation as implicit evaluation.
- **Q:** Why pin all five handler denials? **A:** They are separately wired and
  fail-closed migration requires no stale `workspace:write` route. _Rejected:_
  sampling only open and evaluate.
- **Q:** What is the core per-session separation regression? **A:** Respond-only worker
  answers successfully, then receives 403 on its own verdict and evaluate.
  _Rejected:_ asserting role names without exercising the server scopes.

## Referenced by

[[grill-routes]] · [[grill-service]] · [[review-collaboration-auth]] ·
[[server/_MOC]] · [[Transport]] · [[src/_MOC]]
