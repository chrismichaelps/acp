---
type: module
path: '@root/src/app/cli/gh-reconcile.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[GitHub]]'
tags: [module, test, app, cli, github, pure]
aliases: [gh-reconcile.test]
---

# GitHub Reconciliation Tests

## Purpose

Pin [[gh-reconcile]] merge-gate conjunction and human-readable decision
formatting independently from ACP and [[GitHub]] I/O.

## Interface

Vitest suite for `evaluateMergeGate` and `formatDecision` over wire-shaped
resume fixtures.

## Algorithm

Require a passing gate only for at least one approved review, a passed latest
grill, and zero open comments. Build a failing fixture that violates every
condition and require a reason for each. Treat a null grill as not passed.
Format passing evidence with the grill state and unresolved count, and render
missing review/grill evidence explicitly as `none`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT treat the three merge conditions as alternatives.
- ❌ Do NOT treat a missing grill as passed.
- ❌ Do NOT stop after the first failed condition; report every blocker.
- ❌ Do NOT hide absent evidence in decision text.

## Grill Log

- **Q:** Why collect all reasons? **A:** Operators need one remediation cycle,
  not serial failures that reveal the next blocker only after rerun. _Rejected:_
  first-error-only gate evaluation.

## Referenced by

[[gh-reconcile]] · [[gh-bridge]] · [[gh-merge.test]] · [[cli/_MOC]] ·
[[GitHub]] · [[src/_MOC]]
