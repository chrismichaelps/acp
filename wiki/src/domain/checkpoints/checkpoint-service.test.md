---
type: module
path: '@root/src/domain/checkpoints/checkpoint-service.test.ts'
fidelity: Active
domain: '[[Checkpoint]]'
grammar: '[[grammar/typescript]]'
tags: [module, test, domain, checkpoint]
aliases: [checkpoint-service.test]
---

# Checkpoint Service Tests

## Purpose

Pin [[checkpoint-service]] append-only persistence, event emission,
work/workspace isolation, newest-first ordering, latest selection, and optional
missing reads.

## Interface

Vitest suite over in-memory [[Storage]] plus [[event-store]].

## Algorithm

Create and read a checkpoint and require `checkpoint.created`. Add multiple
checkpoints across work and workspace ids; require work lists newest-first and
workspace lists isolated. Require `latestForWork` to select the newest record.
Return `Option.none` for a missing checkpoint and for latest on missing work.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT overwrite an earlier checkpoint when a newer resume point arrives.
- ❌ Do NOT mix checkpoints from another work or workspace.
- ❌ Do NOT select latest by insertion accident rather than timestamp ordering.
- ❌ Do NOT turn optional absence into a domain failure.
- ❌ Do NOT emit before persistence succeeds.

## Grill Log

- **Q:** Why newest-first lists plus a latest method? **A:** Lists support audit
  history while the dedicated optional latest read keeps resume callers simple.
  _Rejected:_ destructive single-checkpoint storage.

## Referenced by

[[checkpoint-service]] · [[event-store]] · [[checkpoints/_MOC]] ·
[[Checkpoint]] · [[src/_MOC]]
