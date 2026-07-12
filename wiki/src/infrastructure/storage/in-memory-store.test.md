---
type: module
path: '@root/src/infrastructure/storage/in-memory-store.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
tags: [module, test, infrastructure, storage, in-memory]
aliases: [in-memory-store.test]
---

# InMemory Storage Tests

## Purpose

Prove [[in-memory-store]] keyed collection, optimistic concurrency, event/memory
sequence, bounded replay, retention, and indexed-query semantics.

## Interface

Vitest contract suite over `InMemoryStorageLive` and the public [[storage]] seam.

## Algorithm

Exercise put/get/missing/list/remove, absence CAS, whole-value CAS, and version
CAS. Require monotonic workspace-isolated event and memory sequences, cursor and
limit reads, and memory key filtering. Prune aged events while retaining each
workspace's newest sequence watermark, then append without reusing a sequence.
Query by conjunctive allowlisted fields in id order, apply limits after ordering,
reject unknown fields, and return empty for an unwritten collection.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT let stale CAS overwrite a newer value.
- ❌ Do NOT share sequence counters across workspaces or reuse pruned sequences.
- ❌ Do NOT prune the newest event in a workspace.
- ❌ Do NOT apply replay/query limits before ordering and cursor filtering.
- ❌ Do NOT accept an unknown promoted field.

## Grill Log

- **Q:** Why test retention in memory? **A:** Retention is a seam contract, not a
  SQL detail; dev/test behavior must not hide sequence reuse bugs. _Rejected:_
  proving pruning only in durable adapters.

## Referenced by

[[in-memory-store]] · [[storage]] · [[query-conformance.test]] ·
[[storage/_MOC]] · [[Storage]] · [[src/_MOC]]
