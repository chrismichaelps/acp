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

export interface StoredRecord {
  readonly value: unknown
  readonly version: number
}

/** An equality predicate over one promoted, indexed scoping column. */
export interface QueryFilter {
  readonly field: string
  readonly value: string
}

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
  readonly getVersioned: (
    collection: string,
    id: string,
  ) => Effect<Option<StoredRecord>, StorageError>
  readonly replaceIfVersion: (
    collection: string,
    id: string,
    expectedVersion: number,
    value: unknown,
  ) => Effect<boolean, StorageError>
  readonly list: (collection: string) => Effect<Chunk<unknown>, StorageError>
  readonly queryBy: (
    collection: string,
    filters: readonly QueryFilter[],
    opts?: { readonly limit?: number },
  ) => Effect<Chunk<unknown>, StorageError>
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
    limit?: Option<number>,
  ) => Effect<Chunk<Event>, StorageError>
  readonly pruneEventsBefore: (cutoff: string) => Effect<number, StorageError>
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
- `readEventsAfter` owns the hot event replay query shape and accepts an optional
  positive limit so agents can fetch bounded context tails without pulling an
  entire workspace event log.
- `pruneEventsBefore` removes events strictly older than an ISO-8601 cutoff but
  always retains the highest-sequence event per workspace as its append
  high-water mark. The returned count includes only deleted records; later
  appends never reuse a pruned sequence.
- `appendMemory` is the equivalent Memory path and exists to avoid generic `kv`
  scans for thousands of handoff/recall records.
- `getVersioned`/`replaceIfVersion` add optimistic-concurrency-by-version: CAS
  on an O(1) integer instead of `replaceIf`'s whole-blob JSON comparison. Every
  `put`/`putIfAbsent`/`replaceIfVersion` write increments the row's `version`.
- `queryBy` is the scoped predicate read: it returns decoded `value`s (not
  `StoredRecord`s) whose promoted columns equal **every** supplied filter,
  ordered by `id`, with an optional `limit`. Filter fields are restricted to the
  [[index-columns]] `INDEXED_FIELDS` allowlist — an unknown field fails
  `StorageError`, which guards injection and typos and keeps the read on an index
  (SQLite/Postgres) rather than a full scan. This replaces the domain services'
  `list()` + in-app `.filter` pattern (O(N_all)) with an O(log N + k) indexed read.

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
- ❌ Do NOT implement replay limits above the seam when the adapter can push the
  cap into its `(workspace_id, seq)` query.
- ❌ Do NOT prune the newest event in a workspace or reset sequence allocation to
  the surviving row count.

## Grill Log

- **Q:** Does `version` reset when a row's value is overwritten, or does it stay
  monotonic across rewrites? **A:** Monotonic — version is per-row and survives
  value rewrites; it only ever increments, never resets to reflect the new value's
  shape. This lets callers hold a version across unrelated `put`s of other rows
  and treat any mismatch as "someone else wrote since I read."
- **Q:** Why does `queryBy` take `QueryFilter[]` restricted to an allowlist rather
  than an arbitrary predicate function or a raw column name? **A:** A predicate
  function cannot be pushed into a SQL `WHERE`/index (it would force a full scan and
  re-decode), and a raw column name would let a caller name any string — an
  injection and index-miss hazard on the SQL adapters. The allowlisted
  `{ field, value }` equality list is the largest predicate shape that every
  adapter can serve from a real index with bound parameters. Range/`IN`/ordering
  predicates are deliberately out of scope for this tier.
- **Q:** Why return decoded `value`s from `queryBy` instead of `StoredRecord`s like
  `getVersioned`? **A:** Callers migrating off `list()` already consume bare
  values and filter in-app; returning `value`s is a drop-in replacement. Versioned
  reads remain the explicit path for CAS via `getVersioned`.

## Depth

DEEP (0.8). One narrow port hides all persistence; swapping InMemory→SQLite touches
zero domain code. This is the seam's whole value.

## Referenced by

[[storage-index]] · [[in-memory-store]] · [[event-store]] ·
[[workspace-memory-records]] · [[query-conformance.test]] · [[Storage]] ·
[[src/_MOC]]
