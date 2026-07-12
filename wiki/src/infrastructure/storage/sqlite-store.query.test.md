---
type: module
path: '@root/src/infrastructure/storage/sqlite-store.query.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
tags: [module, test, infrastructure, storage, sqlite, query]
aliases: [sqlite-store.query.test]
---

# SQLite Storage Query Tests

## Purpose

Pin [[sqlite-store]] indexed `queryBy` behavior in a focused regression suite.

## Interface

Vitest suite over `SqliteMemoryStorageLive` through the public [[storage]] seam.

## Algorithm

Require every filter to match, rows to sort by id before limiting, rewritten
promoted columns to replace prior query membership, and unknown filter fields to
fail with `StorageError`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT implement OR semantics across filters.
- ❌ Do NOT limit insertion order before sorting.
- ❌ Do NOT leave index columns stale after a value rewrite.
- ❌ Do NOT interpolate an unvalidated filter field into SQL.

## Grill Log

- **Q:** Why retain focused SQLite query coverage when conformance also covers
  it? **A:** This suite stays next to the dynamic SQL/index implementation and
  localizes regressions; conformance proves cross-adapter sameness. _Rejected:_
  relying on only one layer of evidence.

## Referenced by

[[sqlite-store]] · [[query-conformance.test]] · [[storage/_MOC]] · [[Storage]] ·
[[src/_MOC]]
