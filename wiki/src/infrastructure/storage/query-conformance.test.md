---
type: module
path: '@root/src/infrastructure/storage/query-conformance.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
tags: [module, test, infrastructure, storage, conformance]
aliases: [query-conformance.test]
---

# Storage Query Conformance Tests

## Purpose

Run one executable [[storage]] `queryBy` and version-CAS contract unchanged
against [[in-memory-store]] and [[sqlite-store]].

## Interface

Parameterized Vitest suite over `InMemoryStorageLive` and
`SqliteMemoryStorageLive`.

## Algorithm

Require conjunctive equality filters and id ordering, apply limits after
ordering, refresh promoted columns after rewrites, reject unknown fields, return
all ordered rows for an empty filter set, reject stale version CAS without
mutation, and increment the version exactly once for a fresh CAS.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT permit adapter-specific query ordering or filter semantics.
- ❌ Do NOT leave a prior promoted value queryable after rewrite.
- ❌ Do NOT mutate value/version on stale CAS.
- ❌ Do NOT treat an empty filter list as an empty result.

## Grill Log

- **Q:** Why share the exact suite? **A:** Separate lookalike tests can drift;
  parameterization makes behavioral parity structural. _Rejected:_ per-adapter
  copies as the sole conformance evidence.

## Referenced by

[[storage]] · [[in-memory-store]] · [[sqlite-store]] · [[storage/_MOC]] ·
[[Storage]] · [[src/_MOC]]
