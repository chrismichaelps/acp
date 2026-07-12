---
type: module
path: '@root/src/domain/memory/memory-service.test.ts'
fidelity: Active
domain: '[[Memory]]'
grammar: '[[grammar/typescript]]'
tags: [module, test, domain, memory]
aliases: [memory-service.test]
---

# Memory Service Tests

## Purpose

Prove [[memory-service]] appends sequenced recall records, emits creation
evidence, and delegates cursor/key filtering through its storage contract.

## Interface

Vitest suite over in-memory [[Storage]] and [[event-store]].

## Algorithm

Create a memory record and require assigned sequence 1 plus `memory.created`.
Append a second record with a different key/kind, read after sequence 1 with the
second key, and require only that record.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT assign sequence numbers in the service before storage append.
- ❌ Do NOT emit `memory.created` before persistence.
- ❌ Do NOT ignore cursor or key filters.
- ❌ Do NOT update an existing memory record in place.

## Grill Log

- **Q:** Why test cursor and key together? **A:** Recall queries compose
  predicates; validating them separately would miss adapters that accidentally
  apply only one. _Rejected:_ broad list-only coverage.

## Referenced by

[[memory-service]] · [[event-store]] · [[memory/_MOC]] · [[Memory]] ·
[[src/_MOC]]
