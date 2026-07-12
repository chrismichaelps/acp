---
type: module
path: '@root/src/app/server/resume-workspace.test.ts'
fidelity: Active
domain: '[[WorkUnit]]'
grammar: '[[grammar/typescript]]'
tags: [module, test, app, server, resume, pure, tokens]
aliases: [resume-workspace.test]
---

# Resume Workspace Tests

## Purpose

Pin [[resume-workspace]] pure budget parsing, recency selection, gate-critical
review pinning, elided references, and digest/ETag stability.

## Interface

Vitest suite for `parseBudget`, `budgetResume`, `resumeDigest`, and `etagOf` over
minimal artifact/review fixtures.

## Algorithm

Treat missing, empty, negative, fractional, and non-numeric budgets as disabled;
accept non-negative integers. Without a budget return everything and no elision;
with a budget keep the most recent artifacts and reference the rest. Even at
budget zero, pin approved reviews and the review owning the latest grill. Fill
remaining review slots by recency. Require digest stability for identical input,
changes for budget or packet changes, and quoted ETags.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT treat malformed budgets as zero and accidentally elide all content.
- ❌ Do NOT drop approved or latest-grill reviews under any budget.
- ❌ Do NOT lose ids for elided records.
- ❌ Do NOT make digest depend only on the visible budgeted subset.
- ❌ Do NOT emit an unquoted HTTP entity tag.

## Grill Log

- **Q:** Can pinned reviews exceed the numeric budget? **A:** Yes. Merge-gate
  correctness outranks token capacity; a budget may reduce context but cannot
  hide approval or latest-grill evidence. _Rejected:_ strict cap that flips gate
  evaluation.

## Referenced by

[[resume-workspace]] · [[resume-workspace-routes.test]] ·
[[ADR-0010-context-exchange-optimization]] · [[server/_MOC]] · [[src/_MOC]]
