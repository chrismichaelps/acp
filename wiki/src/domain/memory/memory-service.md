---
type: module
path: '@root/src/domain/memory/memory-service.ts'
fidelity: Active
domain: '[[Memory]]'
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
depth_score: 0.74
depth_status: DEEP
tags: [module, deep]
aliases: [memory-service, MemoryService]
---

# Memory Service

## Purpose

Own append-oriented [[Memory]] records for v0.1. The service stores records
through [[Storage]], emits `memory.created` through [[EventStore]], and exposes
cursor reads for workers resuming or handing off workspace context.

## Interface

```typescript
export interface CreateMemoryInput {
  readonly id: MemoryId
  readonly payload: CreateMemoryPayload
  readonly createdBy: WorkerId
  readonly now: Timestamp
}

export interface MemoryServiceApi {
  readonly create: (input: CreateMemoryInput) => Effect<Memory, StorageError>
  readonly read: (
    query: ReadMemoryQuery,
  ) => Effect<readonly Memory[], StorageError>
}
```

## Algorithm

1. `create` builds a Memory draft from the create payload and caller-owned id,
   actor, and timestamp.
2. It appends the draft through [[Storage]], which assigns the workspace-scoped
   `seq`.
3. It emits `memory.created` with the new memory id, kind, key, and summary.
4. `read` delegates to [[Storage]] so SQLite and in-memory adapters preserve the
   same cursor and filter semantics.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT store Memory through generic `kv` collections.
- ❌ Do NOT emit `memory.created` before storage succeeds.
- ❌ Do NOT add update/delete; a new Memory record supersedes an old one.

## Depth

DEEP (0.74). The service hides sequence ownership, event emission, and storage
query shape behind a compact domain surface.

## Grill Log

- **Q:** Should Memory support updates?
  **A:** No. Append-only records preserve handoff history and avoid cache
  invalidation semantics. A correction is a new Memory record with the same key.

## Referenced by

[[memory-service.test]] · [[memory/_MOC]] · [[Memory]] ·
[[workspace-memory-records]] · [[src/_MOC]]
