---
type: module
path: '@root/src/infrastructure/storage/in-memory-store.ts'
fidelity: Active
domain: '[[Event]]'
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
depth_score: 0.72
depth_status: DEEP
tags: [module, deep, seam]
aliases: [in-memory-store, InMemoryStorage]
---

# InMemory Storage (production adapter)

## Purpose

The first production adapter behind the [[Storage]] seam. Backs all state with
Effect `Ref`-guarded immutable `HashMap`/`Chunk` so concurrent fibers never race.
Zero native dependencies — lets the whole protocol be exercised and tested before
SQLite exists.

## Interface

### Signatures

```typescript
export const InMemoryStorageLive: Layer.Layer<Storage>
```

## Algorithm

Two `Ref`s constructed in the Layer's scoped effect:

1. `collections: Ref<HashMap<string, HashMap<string, unknown>>>` — collection → (id → value).
2. `events: Ref<HashMap<string, Chunk<Event>>>` — workspaceId → ordered event log.
3. `memory: Ref<HashMap<string, Chunk<Memory>>>` — workspaceId → ordered memory records.

- **put** — `Ref.update`: get-or-empty the inner map, `HashMap.set(id, value)`, set back.
- **get** — read ref, `HashMap.get(collection)` then `HashMap.get(id)` → `Option`.
- **list** — read ref, `Chunk.fromIterable(HashMap.values(inner))` (empty if absent).
- **remove** — `Ref.update` removing the id from the inner map.
- **appendEvent** — `Ref.modify` atomically: read the workspace's chunk (empty if
  absent), `seq = Chunk.size + 1`, build the full `Event` from the draft, append,
  store, and return the full event. Atomic modify guarantees no two events share a seq.
- **readEventsAfter** — read ref, get the chunk, `Chunk.filter(e => e.seq > afterSeq)`.
- **appendMemory** — same sequence-ownership pattern for [[Memory]] records.
- **readMemory** — read ref, filter by `afterSeq` plus optional work id / kind / key /
  label, preserving chronological order.

All operations are total in memory, so each returns `Effect.succeed(...)`; the
`StorageError` channel exists for the seam contract and the SQLite adapter.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT use a mutable `Map`/array for state — `Ref` + immutable `HashMap`/`Chunk` only.
- ❌ Do NOT compute `seq` outside the atomic `Ref.modify` (would allow duplicate seqs).
- ❌ Do NOT import Node built-ins — this adapter is pure in-memory.
- ❌ Do NOT implement Memory as a generic collection scan; mirror the SQLite cursor
  semantics in memory.

## Depth

DEEP (0.72). Hides all concurrency-safe state behind the seam interface; deletion
forces every service to manage its own mutable state.

## Referenced by

[[storage-index]] · [[storage]] · [[workspace-memory-records]] · [[Storage]] ·
[[src/_MOC]]
