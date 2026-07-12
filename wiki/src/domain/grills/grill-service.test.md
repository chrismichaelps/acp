---
type: module
path: '@root/src/domain/grills/grill-service.test.ts'
fidelity: Active
domain: '[[Grill]]'
grammar: '[[grammar/typescript]]'
tags: [module, test, domain, grill, review-gate]
aliases: [grill-service.test]
---

# Grill Service Tests

## Purpose

Prove [[grill-service]] enforces one open gate per review, question lifecycle,
and the semantic distinction between incomplete, passed, and failed outcomes.

## Interface

Vitest suite over in-memory [[Storage]], [[event-store]], and
[[review-comment-service]].

## Algorithm

Open a grill and reject a second concurrent open gate. Add a blocker in pending
state, answer it, and accept its verdict. Evaluate a pending blocker and require
`incomplete` with grill still open. Evaluate accepted blockers with no open
comments and require `pass/passed`. Evaluate a rejected blocker and require
`fail/failed` plus a non-empty blocking reason list.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT allow two open grills for one review.
- ❌ Do NOT turn a pending obligation into terminal failure.
- ❌ Do NOT mutate grill state on incomplete evaluation.
- ❌ Do NOT pass a rejected blocker or omit its blocking reason.
- ❌ Do NOT conflate question verdict mutation with gate evaluation.

## Grill Log

- **Q:** Why preserve `incomplete` as re-evaluable? **A:** Pending answers and
  open comments are unfinished work, not reviewer rejection. _Rejected:_ mark
  failed before the agent can remediate.

## Referenced by

[[grill-service]] · [[review-comment-service]] · [[grills/_MOC]] · [[Grill]] ·
[[src/_MOC]]
