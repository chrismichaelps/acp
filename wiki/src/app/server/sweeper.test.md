---
type: module
path: '@root/src/app/server/sweeper.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, server, sweeper, retention]
aliases: [sweeper.test]
---

# Expiry Sweeper Tests

## Purpose

Prove [[sweeper]] deterministically evicts stale auth state, expires due leases,
respects leadership, preserves fresh state, and applies event retention.

## Interface

Vitest suite over `AppLive ⊕ IdClockLive` with seeded sessions, leases, and
events plus granted and denied leadership fixtures.

## Algorithm

Seed stale/fresh sessions and an overdue active lease, run `sweepOnce`, and
require stale eviction, fresh survival, and lease state `expired`. Require an
empty store to produce zero counts. Under denied leadership, return
`Option.none` and leave the overdue lease active; under local leadership, expire
it. Seed one ancient and one current event, sweep, and require exactly one prune
with the recent event retained.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT evict fresh sessions or active leases before their deadline.
- ❌ Do NOT mutate any state when leadership is unavailable.
- ❌ Do NOT interpret an empty store as a failure.
- ❌ Do NOT prune recent events with expired history.
- ❌ Do NOT test a separate store from the host composition.

## Grill Log

- **Q:** Why assert stored lease state after the result summary? **A:** A reported
  expiry without persistence would mislead operators and still permit conflicts.
  _Rejected:_ return-value-only verification.

## Referenced by

[[sweeper]] · [[sweeper-leadership]] · [[session-service]] ·
[[lease-service]] · [[event-store]] · [[server/_MOC]] · [[src/_MOC]]
