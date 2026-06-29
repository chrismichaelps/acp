---
type: module
path: '@root/src/infrastructure/storage/storage.ts'
fidelity: Active
domain: '[[Event]]'
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
depth_score: 0.8
depth_status: DEEP
tags: [module, deep, seam]
aliases: [storage, StorageTag]
---

# Storage (seam interface)

## Purpose

The persistence port for the [[Storage]] seam. A pure `Context.Tag` interface that
every domain service depends on, with **no construction leaked** — adapters
(InMemory now, SQLite later) are provided as swappable Layers. Holds two shapes of
state: keyed entity collections, the append-only ordered [[Event]] log that
assigns each event its monotonic per-workspace `seq`, and optimized
workspace-scoped [[Memory]] records.

## Interface

### Signatures

```typescript
export type EventDraft = Omit<Event, 'seq'> // caller supplies all but seq
export type MemoryDraft = Omit<Memory, 'seq'>

export interface StorageApi {
  readonly put: (
    collection: string,
    id: string,
    value: unknown,
  ) => Effect<void, StorageError>
  readonly get: (
    collection: string,
    id: string,
  ) => Effect<Option<unknown>, StorageError>
  readonly list: (collection: string) => Effect<Chunk<unknown>, StorageError>
  readonly remove: (
    collection: string,
    id: string,
  ) => Effect<void, StorageError>
  readonly appendEvent: (
    workspaceId: string,
    draft: EventDraft,
  ) => Effect<Event, StorageError>
  readonly readEventsAfter: (
    workspaceId: string,
    afterSeq: number,
  ) => Effect<Chunk<Event>, StorageError>
  readonly appendMemory: (
    workspaceId: string,
    draft: MemoryDraft,
  ) => Effect<Memory, StorageError>
  readonly readMemory: (
    query: ReadMemoryQuery,
  ) => Effect<Chunk<Memory>, StorageError>
}
export class Storage extends Context.Tag('Storage')<Storage, StorageApi>() {}
```

### Governance

- Collection values are `unknown` at this layer — typing/decoding is the caller's
  job (future domain repositories decode through Effect Schema). Storage never
  inspects entity shape except [[Event]] and [[Memory]] records, whose
  per-workspace `seq` values and hot cursor reads are owned by the adapter.
- `appendEvent` is the **only** way to obtain a `seq`; callers never set it.
- `appendMemory` is the equivalent Memory path and exists to avoid generic `kv`
  scans for thousands of handoff/recall records.

### Linkage

- **Requires:** [[event.schema]], [[protocol-error]] (`StorageError`)
- **Consumed by:** every domain service (future slices)

## Algorithm

Interface only — no behavior. Behavior lives in adapters; see [[in-memory-store]].

## Negative Logic (Prohibited Paths)

- ❌ Do NOT leak adapter construction (Ref, SQL handle) through this interface.
- ❌ Do NOT let a caller assign `Event.seq` — `appendEvent` owns it.
- ❌ Do NOT add entity-specific methods here unless the data shape needs
  adapter-owned sequencing or query-plan guarantees; [[Memory]] is the v0.1
  exception because it requires `(workspace_id, seq)` cursor reads.

## Depth

DEEP (0.8). One narrow port hides all persistence; swapping InMemory→SQLite touches
zero domain code. This is the seam's whole value.

## Referenced by

[[storage-index]] · [[in-memory-store]] · [[event-store]] ·
[[workspace-memory-records]] · [[Storage]] · [[src/_MOC]]
