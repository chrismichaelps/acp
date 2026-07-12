---
type: module
path: '@root/src/domain/workspaces/workspace-service.test.ts'
fidelity: Active
domain: '[[Workspace]]'
grammar: '[[grammar/typescript]]'
tags: [module, test, domain, workspace]
aliases: [workspace-service.test]
---

# Workspace Service Tests

## Purpose

Prove [[workspace-service]] create/list/update/archive persistence, ordered event
emission, archive immutability, and distinct optional/error missing semantics.

## Interface

Vitest suite over in-memory [[Storage]] and [[event-store]].

## Algorithm

Create an active workspace, read it, and require `workspace.created`. Create a
second record and list both. Replace an existing active workspace and require
`workspace.updated`. Archive it, persist state `archived`, and emit
`workspace.archived`. Reject later update with `InvalidStateTransitionError`.
Return `Option.none` for get-missing and `NotFoundError` for update-missing.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT physically delete a workspace during archive.
- ❌ Do NOT mutate an archived workspace.
- ❌ Do NOT hide archived records from registry semantics.
- ❌ Do NOT conflate optional get absence with mutation-target absence.
- ❌ Do NOT emit workspace events before persistence.

## Grill Log

- **Q:** Why is archive one-way? **A:** It preserves audit history and prevents
  new mutation on a retired coordination boundary. _Rejected:_ soft-delete flag
  that route/service callers can accidentally ignore.

## Referenced by

[[workspace-service]] · [[event-store]] · [[workspaces/_MOC]] · [[Workspace]] ·
[[src/_MOC]]
