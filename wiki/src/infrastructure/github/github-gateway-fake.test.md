---
type: module
path: '@root/src/infrastructure/github/github-gateway-fake.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
tags: [module, test]
aliases: [github-gateway-fake.test]
---

# GitHub Gateway Fake Tests

## Purpose

Prove the fake reflects posted comments and records merge requests.

## Interface

Vitest suite for [[github-gateway-fake|makeGitHubGatewayFake]].

## Algorithm

Post then list a comment through the provided Layer; separately merge and inspect
recorded fake state.

## Negative Logic

- ❌ Do NOT use `gh` or network access.

## Depth

MEDIUM. Protects the state reflection used by bridge idempotency tests.

## Grill Log

- **Q:** Why inspect both returned values and fake state? **A:** Callers depend on
  the service view while tests also need an assertion ledger.

## Referenced by

[[github-gateway-fake]] · [[github/_MOC]]
