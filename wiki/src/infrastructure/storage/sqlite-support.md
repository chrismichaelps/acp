---
type: module
path: '@root/src/infrastructure/storage/sqlite-support.ts'
fidelity: Active
domain: '[[Event]]'
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
depth_score: 0.4
depth_status: SHALLOW
tags: [module, shallow, support]
aliases: [sqlite-support, SqliteSupport]
---

# SQLite Support

## Purpose

Pure serialization and row-mapping helpers extracted from [[sqlite-store]] under
the Split Protocol so the adapter stays within the source line cap. Every symbol
here is independent of any open database handle or prepared statement — it maps
untyped SQLite rows to typed values, encodes/decodes JSON, wraps synchronous
SQLite calls in `StorageError`-tagged effects, and rolls a transaction back.

## Interface

### Signatures

```typescript
export const toCause: (cause: unknown) => string
export const storageTry: <A>(
  op: string,
  body: () => A,
) => Effect.Effect<A, StorageError>
export const parseJson: (
  op: string,
  text: string,
) => Effect.Effect<unknown, StorageError>
export const encodeJson: (
  op: string,
  value: unknown,
) => Effect.Effect<string, StorageError>
export const jsonRow: (
  row: Record<string, unknown> | undefined,
) => Option.Option<JsonRow>
export const jsonRows: (
  rows: readonly Record<string, unknown>[],
) => readonly JsonRow[]
export const seqRow: (row: Record<string, unknown> | undefined) => SeqRow
export const decodeEvent: (
  op: string,
  value: unknown,
) => Effect.Effect<Event, StorageError>
export const decodeMemory: (
  op: string,
  value: unknown,
) => Effect.Effect<Memory, StorageError>
export const optionalText: <A>(option: Option.Option<A>) => A | null
export const memoryRowsToChunk: (
  rows: readonly JsonRow[],
  query: ReadMemoryQuery,
) => Effect.Effect<Chunk.Chunk<Memory>, StorageError>
export const rollback: (db: DatabaseSync) => void
```

### Linkage

- **Requires:** [[storage]], [[event.schema]], [[protocol-error]] (`StorageError`),
  Node `node:sqlite` `DatabaseSync` (type-only, for `rollback`).
- **Consumed by:** [[sqlite-store]] only.

## Algorithm

No control flow of its own — each helper is a single expression or a thin
`try`/`catch`. `storageTry` centralizes the `StorageError` tagging every SQLite
call shares; `jsonRow`/`jsonRows`/`seqRow` narrow `Record<string, unknown>`
rows into typed shapes; `decodeEvent`/`decodeMemory` route persisted JSON back
through the protocol schemas so stored data cannot drift from the model;
`memoryRowsToChunk` decodes and applies the secondary kind/label filters with
the query limit; `rollback` swallows a failed `ROLLBACK` so the original
SQLite/encoding error survives.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT add any function here that closes over a `DatabaseSync` instance or a
  prepared statement — those belong in [[sqlite-store]]'s `make`.
- ❌ Do NOT return raw parsed JSON for events or memory; decode through the
  schemas.

## Depth

SHALLOW (0.4). This is a cohesion split, not a new seam: the helpers were always
part of the SQLite adapter's internals and remain private to it.

## Grill Log

- **Q:** Why a separate module instead of leaving the helpers in `sqlite-store.ts`?
  **A:** The version-column CAS work pushed the adapter to 502 lines, over the
  500-line source cap. _Rationale:_ the pure, db-independent helpers form a
  natural cohesion boundary, so a pure move (no logic change) restores both
  files under the cap. _Rejected:_ raising the cap for one file.

## Referenced by

[[sqlite-store]] · [[storage]] · [[src/_MOC]]
