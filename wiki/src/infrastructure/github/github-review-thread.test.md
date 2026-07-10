---
type: module
path: '@root/src/infrastructure/github/github-review-thread.test.ts'
fidelity: Active
domain: '[[Review]]'
grammar: '[[grammar/typescript]]'
tags: [module, test]
aliases: [github-review-thread.test]
---

# GitHub Review Thread Resolver Tests

## Purpose

Pin REST-comment → GraphQL-thread lookup without network access.

## Interface

Vitest suite injecting a scripted `RunGhText` into
[[github-review-thread|makeReviewThreadResolver]].

## Algorithm

Cover first-page success, next-page cursor traversal, already-resolved state,
invalid REST ids, malformed GraphQL payloads, and exhausted missing-thread pages.

## Negative Logic

- ❌ Do NOT call GitHub or depend on authenticated `gh`.
- ❌ Do NOT replace live sandbox proof; this suite pins deterministic mechanics.

## Depth

MEDIUM. Small fixtures protect pagination and typed failure branches.

## Grill Log

- **Q:** Is one happy-path fixture enough? **A:** No. The live defect exists at an
  API identity boundary, so invalid id, pagination, malformed response, and
  missing-thread cases must remain explicit.

## Referenced by

[[github-review-thread]] · [[github/_MOC]]
