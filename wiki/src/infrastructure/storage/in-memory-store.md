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

1. `collections: Ref<HashMap<string, HashMap<string, StoredRecord>>>` — collection → (id → `{ value, version }`).
2. `events: Ref<HashMap<string, Chunk<Event>>>` — workspaceId → ordered event log.
3. `memory: Ref<HashMap<string, Chunk<Memory>>>` — workspaceId → ordered memory records.

- **put** — `Ref.update`: get-or-empty the inner map, store
  `{ value, version: (existing?.version ?? 0) + 1 }`, set back.
- **get** — read ref, `HashMap.get(collection)` then `HashMap.get(id)` → `Option`,
  projected to `.value`.
- **getVersioned** — same lookup as `get` but returns the whole `StoredRecord`
  (value + version) unprojected.
- **replaceIf** — `Ref.modify`: compare the stored row's `.value` against
  `expected` via JSON-string equality; on match, write the new value and
  increment version, else no-op and return `false`.
- **replaceIfVersion** — `Ref.modify`: compare the stored row's `.version`
  against `expectedVersion`; on match, write `{ value, version: version + 1 }`
  and return `true`, else no-op and return `false`. O(1) integer compare vs.
  `replaceIf`'s whole-blob JSON comparison.
- **putIfAbsent** — inserts `{ value, version: 1 }` only if the id is absent.
- **list** — read ref, `Chunk.fromIterable(HashMap.values(inner))` projected to
  each row's `.value` (empty if absent).
- **remove** — `Ref.update` removing the id from the inner map.
- **appendEvent** — `Ref.modify` atomically: read the workspace's chunk (empty if
  absent), `seq = Chunk.size + 1`, build the full `Event` from the draft, append,
  store, and return the full event. Atomic modify guarantees no two events share a seq.
- **readEventsAfter** — read ref, get the chunk, filter by
  `e.seq > afterSeq`, then apply the optional limit with `Chunk.take`.
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
- ❌ Do NOT ignore replay limits; in-memory tests mirror the production query
  contract even though the adapter is not SQL-backed.

## Grill Log

- **Q:** Should `replaceIf`'s whole-value CAS also bump `version`, even though the
  caller only ever observes version through `getVersioned`/`replaceIfVersion`?
  **A:** Yes — every successful write (`put`, `putIfAbsent`, `replaceIf`,
  `replaceIfVersion`) increments `version`, so the counter always reflects the
  true number of writes to a row. Version is per-row monotonic and survives
  value rewrites; skipping the bump on `replaceIf` would let a later
  `replaceIfVersion` CAS succeed against a version that no longer matches the
  row's actual value history.

## Depth

DEEP (0.72). Hides all concurrency-safe state behind the seam interface; deletion
forces every service to manage its own mutable state.

## Referenced by

[[storage-index]] · [[storage]] · [[workspace-memory-records]] · [[Storage]] ·
[[src/_MOC]]
