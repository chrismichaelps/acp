---
type: module
path: '@root/src/app/server/review-comment-routes.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, server, review-comment]
aliases: [review-comment-routes.test]
---

# Review Comment Route Tests

## Purpose

Prove [[review-comment-routes]] preserves a diff anchor and exposes consistent
review/work listing plus resolve/reopen state transitions.

## Interface

Vitest integration suite over the in-process [[acp-router]] after preparing
running work and a requested review.

## Algorithm

Add an open comment containing review/work/workspace identity and an artifact,
file, line, and side target. Require the comment in both review-scoped and
work-scoped lists. Resolve it to `resolved`, then reopen it to `open` through the
comment-id routes.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT drop or reinterpret the diff anchor at the transport boundary.
- ❌ Do NOT let review and work collection views diverge.
- ❌ Do NOT treat resolve as terminal; explicit reopen is supported.
- ❌ Do NOT mutate comment state in route code instead of the service.

## Grill Log

- **Q:** Why assert both list routes? **A:** Reviewers navigate by gate while
  resuming agents navigate by work; both must expose the same stored obligation.
  _Rejected:_ verifying only the creation response.

## Referenced by

[[review-comment-routes]] · [[review-comment-service]] ·
[[resource-workspace-auth]] · [[server/_MOC]] · [[Transport]] · [[src/_MOC]]
