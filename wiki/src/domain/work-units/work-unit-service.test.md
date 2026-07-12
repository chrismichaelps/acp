---
type: module
path: '@root/src/domain/work-units/work-unit-service.test.ts'
fidelity: Active
domain: '[[WorkUnit]]'
grammar: '[[grammar/typescript]]'
tags: [module, test, domain, work-unit, concurrency]
aliases: [work-unit-service.test]
---

# Work Unit Service Tests

## Purpose

Prove [[work-unit-service]] defaults, atomic claims, state-machine recovery,
workspace indexes, error taxonomy, CAS loss behavior, and ordered event emission.

## Interface

Vitest suite over in-memory [[Storage]]/[[event-store]], plus a storage decorator
that forces `replaceIfVersion` failure.

## Algorithm

Create open work and emit `work.created`; claim and assign a worker. Reject a
second holder with `ClaimConflictError` naming the owner, and force the CAS-loss
branch to the same conflict. Isolate workspace lists. Drive
`changes_requested → running`, reject stale and illegal transitions with
`InvalidStateTransitionError`, return `NotFoundError` for missing work, and pin
ordered created/claimed/started/blocked events.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT implement claim as an unconditional overwrite.
- ❌ Do NOT lose the current holder in claim-conflict evidence.
- ❌ Do NOT accept stale or illegal state transitions.
- ❌ Do NOT leak another workspace's work into an index.
- ❌ Do NOT emit transition events before persistence.

## Grill Log

- **Q:** Why inject deterministic CAS failure? **A:** Ordinary sequential tests
  cannot reliably hit the lost-race branch; the decorator proves the concurrency
  invariant without flaky timing. _Rejected:_ probabilistic racing tests.

## Referenced by

[[work-unit-service]] · [[event-store]] · [[work-units/_MOC]] · [[WorkUnit]] ·
[[src/_MOC]]
