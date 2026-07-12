---
type: module
path: '@root/src/infrastructure/storage/sqlite-store.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
tags: [module, test, infrastructure, storage, sqlite]
aliases: [sqlite-store.test]
---

# SQLite Storage Tests

## Purpose

Prove [[sqlite-store]] full adapter behavior, durable reopen semantics, bounded
large-tail reads, query-plan indexes, and retention watermark safety.

## Interface

Vitest adapter suite over memory-backed and temporary file-backed SQLite layers,
with `EXPLAIN QUERY PLAN` inspection.

## Algorithm

Exercise keyed CRUD and CAS; workspace-isolated event/memory sequences; bounded
cursor reads including thousands-record tails; and memory cursor/key/work index
plans. Reopen a file database and preserve values plus the next event sequence.
Require composite primary-key plans for collection/event reads. Prune aged events
per workspace while retaining the newest watermark and continuing sequence
allocation.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT lose values or sequence state when reopening a file database.
- ❌ Do NOT scan large event/memory histories to read a small tail.
- ❌ Do NOT miss the declared primary/secondary indexes on hot reads.
- ❌ Do NOT prune a workspace's newest event or reuse its sequence.
- ❌ Do NOT leak temporary databases after a test.

## Grill Log

- **Q:** Why assert query plans, not only results? **A:** Correct results from a
  table scan violate the scale contract and can regress invisibly as data grows.
  _Rejected:_ performance confidence from functional equality alone.

## Referenced by

[[sqlite-store]] · [[storage]] · [[sqlite-store.query.test]] ·
[[query-conformance.test]] · [[storage/_MOC]] · [[Storage]] · [[src/_MOC]]
