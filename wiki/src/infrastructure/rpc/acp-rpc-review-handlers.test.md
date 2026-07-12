---
type: module
path: '@root/src/infrastructure/rpc/acp-rpc-review-handlers.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, infrastructure, rpc, review]
aliases: [acp-rpc-review-handlers.test]
---

# ACP RPC Review Handler Tests

## Purpose

Pin [[acp-rpc-review-handlers]] approval, cancellation, requested-changes,
rejection, indexing, transition errors, and middleware actor bridging.

## Interface

Vitest `accessHandler` suite over running WorkUnits in the native RPC runtime.

## Algorithm

Create independent running work units and reviews for all four outcomes. Require
their distinct terminal states, work-specific membership, and complete workspace
membership. Attempt a second approval and require
`invalid_state_transition`. Separately approve through middleware-provided actor
context even when the bearer token is invalid.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT conflate cancel, reject, and request-changes outcomes.
- ❌ Do NOT allow a second outcome on a terminal review.
- ❌ Do NOT omit a review from its work or workspace index.
- ❌ Do NOT re-authenticate a middleware-provided actor through bearer fallback.

## Grill Log

- **Q:** Why use four work units? **A:** Each review outcome mutates its parent
  WorkUnit; isolation prevents one transition from masking another. _Rejected:_
  reusing a terminal review/work pair.

## Referenced by

[[acp-rpc-review-handlers]] · [[acp-rpc-handlers]] · [[rpc/_MOC]] ·
[[Transport]] · [[src/_MOC]]
