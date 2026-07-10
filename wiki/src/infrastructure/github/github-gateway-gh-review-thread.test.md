---
type: module
path: '@root/src/infrastructure/github/github-gateway-gh-review-thread.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[GitHub]]'
tags: [module, test]
aliases: [github-gateway-gh-review-thread.test]
---

# GitHub Gateway gh Review Thread Tests

## Purpose

Pin [[github-gateway-gh]] lookup-then-mutate orchestration separately from the
general adapter argv suite.

## Interface

Vitest suite injecting a fake process runner into `makeGhGateway`.

## Algorithm

Prove an unresolved REST comment causes a review-thread lookup followed by a
mutation using the GraphQL node id, while an already-resolved thread performs
only the lookup.

## Negative Logic

- ❌ Do NOT call GitHub.
- ❌ Do NOT accept the numeric REST comment id as the mutation `threadId`.

## Depth

MEDIUM. Two cases protect the adapter's live-only identity boundary.

## Grill Log

- **Q:** Why a separate test file? **A:** Resolution is an independently changing
  responsibility and moving it keeps [[github-gateway-gh.test]] within the FMCF
  Split Protocol threshold.

## Referenced by

[[github-gateway-gh]] · [[github-review-thread]] · [[github/_MOC]]
