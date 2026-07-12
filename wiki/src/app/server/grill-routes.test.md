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
HTTP from review preparation to a passing evaluation.

## Interface

Vitest integration suite over the in-process [[acp-router]] with a scoped
review-capable worker.

## Algorithm

Create, claim, and run work; request review; open a grill; and require review-
scoped list visibility. Add a blocker question, answer it, set an accepted
verdict, and read `GrillDetail` containing both gate and question. Evaluate and
require `outcome=pass`, grill state `passed`, and no blocking question ids.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT pass while a blocker remains pending, unanswered, or rejected.
- ❌ Do NOT return a bare grill from the detail route.
- ❌ Do NOT omit a newly opened grill from its review-scoped list.
- ❌ Do NOT decide the gate inside route code; the service owns evaluation.

## Grill Log

- **Q:** Is an accepted verdict enough evidence? **A:** No. The suite separately
  calls evaluate and pins the resulting gate state and blocking list. _Rejected:_
  treating question mutation as implicit evaluation.

## Referenced by

[[grill-routes]] · [[grill-service]] · [[resource-workspace-auth]] ·
[[server/_MOC]] · [[Transport]] · [[src/_MOC]]
