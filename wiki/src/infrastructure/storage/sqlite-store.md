---
type: module
path: '@root/src/infrastructure/storage/sqlite-store.ts'
fidelity: Active
domain: '[[Event]]'
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
depth_score: 0.74
depth_status: DEEP
tags: [module, deep, seam]
aliases: [sqlite-store, SqliteStorage]
---

# SQLite Storage

## Purpose

File-backed production adapter behind the [[Storage]] seam (spec §17). It provides
the same keyed JSON collections, per-workspace append-only [[Event]] log, and
optimized [[Memory]] record table as [[in-memory-store]], but persists them
through Node 24's built-in `node:sqlite` runtime without adding a package
dependency.

## Interface

### Signatures

```typescript
export const makeSqliteStorageLive: (
  path: string,
) => Layer.Layer<Storage, StorageError>
export const SqliteMemoryStorageLive: Layer.Layer<Storage, StorageError>
```

### Tables

```sql
kv(collection TEXT, id TEXT, value TEXT, PRIMARY KEY(collection, id))
events(workspace_id TEXT, seq INTEGER, value TEXT, PRIMARY KEY(workspace_id, seq))
memory(workspace_id TEXT, seq INTEGER, id TEXT, work_id TEXT, kind TEXT, key TEXT,
       labels_json TEXT, value_json TEXT, created_at TEXT,
       PRIMARY KEY(workspace_id, seq), UNIQUE(workspace_id, id))
```

All three tables are created `WITHOUT ROWID`, so the composite primary key is the
table layout. Hot reads use those keys directly: `kv(collection, id)`,
`kv(collection) ORDER BY id`, `events(workspace_id, seq)` for tail replay, and
`memory(workspace_id, seq)` for memory cursor reads. Secondary indexes cover
memory key/work handoff reads.

### Linkage

- **Requires:** [[storage]], [[event.schema]], [[protocol-error]] (`StorageError`),
  Node `node:sqlite` at the infrastructure edge.
- **Consumed by:** adapter tests now; later host wiring chooses it when persistent
  local storage becomes the default.

## Algorithm

Open the database in a scoped Layer, set `busy_timeout`, WAL journaling, and
`synchronous=NORMAL`, create the three `WITHOUT ROWID` tables, prepare statements
once, and close the handle on release. `put` encodes the unknown value as JSON and
upserts into `kv`; `get` loads one JSON cell and returns `Option.none` for absence;
`list` walks only the requested collection in primary-key order; `remove` deletes
the row.

`appendEvent` owns sequence assignment inside the adapter. It reads
`MAX(seq) + 1` for the workspace inside a `BEGIN IMMEDIATE` transaction, writes the
full event as JSON, commits, and returns that event to the caller. `readEventsAfter`
selects rows where `seq > afterSeq` ordered by `seq` and decodes each row through
the [[event.schema]] so persisted data cannot silently drift from the protocol
model. Tests assert the query plan uses the composite primary keys for collection
and event reads and include a thousands-of-events tail replay regression.

`appendMemory` mirrors event sequence ownership for [[Memory]] records. It assigns
`MAX(seq) + 1` inside `BEGIN IMMEDIATE`, stores the encoded record plus
query columns, and returns the decoded record. `readMemory` uses the
`(workspace_id, seq)` cursor by default and may constrain by key or work id
through secondary indexes.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT expose SQLite statements or database handles through [[Storage]].
- ❌ Do NOT let services compute event `seq`; it belongs to the adapter.
- ❌ Do NOT return raw parsed JSON for events — decode persisted event rows through
  [[event.schema]].
- ❌ Do NOT prepare statements per operation on hot paths; prepare once per Layer.
- ❌ Do NOT full-scan the event table for replay; constrain by `(workspace_id, seq)`.
- ❌ Do NOT read Memory through the generic `kv` collection; use the dedicated
  table and cursor/index statements.
- ❌ Do NOT add a third-party SQLite dependency for this slice; Node 24 provides the
  local runtime surface.

## Depth

DEEP (0.74). The adapter hides persistence, schema creation, JSON cell encoding,
row decoding, and sequence ownership behind the existing seam. Deleting it would
force domain services to know about SQL and durable ordering.

## Grill Log

- **Q:** Use `node:sqlite` or add a package?
  **A:** Use `node:sqlite`. _Rationale:_ Node 24 and `@types/node` in this repo
  already expose `DatabaseSync`, so the adapter can land without install churn or
  native dependency drift. _Rejected:_ adding `better-sqlite3` or `@effect/sql`
  before the storage seam needs SQL-specific query composition.
- **Q:** Wire SQLite as the default `AppLive` storage now?
  **A:** No. _Rationale:_ this slice proves the second production adapter behind
  the seam without changing local-host default behavior or test isolation. Host
  selection can become a small config slice after the adapter is verified.

## Referenced by

[[storage-index]] · [[storage]] · [[workspace-memory-records]] · [[Storage]] ·
[[src/_MOC]]
