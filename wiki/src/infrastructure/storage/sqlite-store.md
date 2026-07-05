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
kv(collection TEXT, id TEXT, value TEXT, version INTEGER NOT NULL DEFAULT 1,
   PRIMARY KEY(collection, id))
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

The `kv.version` column is a per-row monotonic counter added idempotently on
boot (SQLite has no `ADD COLUMN IF NOT EXISTS`, so a `PRAGMA table_info` guard
runs the `ALTER TABLE` only when the column is absent). New rows start at
version `1`; every successful write — `put` upsert, `replaceIf`, and
`replaceIfVersion` — bumps it by one, matching [[in-memory-store]] and
[[postgres-store]] so the three adapters version identically.

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
the row. `getVersioned` returns the row's value paired with its `version`;
`replaceIfVersion` is an O(1) compare-and-swap that `UPDATE`s only when the
current `version` equals the caller's expected version (`... SET value = ?,
version = version + 1 WHERE ... AND version = ?`), succeeding when SQLite
reports one changed row — cheaper than `replaceIf`'s whole-blob comparison.

The pure serialization and row-mapping helpers (`storageTry`, `parseJson`,
`encodeJson`, `jsonRow`, `jsonRows`, `seqRow`, `decodeEvent`, `decodeMemory`,
`optionalText`, `memoryRowsToChunk`, `rollback`) live in the sibling
[[sqlite-support]] module so this adapter stays under the source line cap;
they close over no database handle, so the split is a pure move.

`appendEvent` owns sequence assignment inside the adapter. It reads
`MAX(seq) + 1` for the workspace inside a `BEGIN IMMEDIATE` transaction, writes the
full event as JSON, commits, and returns that event to the caller.
`readEventsAfter` selects rows where `seq > afterSeq`, orders by `seq`, applies
the optional `LIMIT`, and decodes each row through the [[event.schema]] so
persisted data cannot silently drift from the protocol model. Tests assert the
query plan uses the composite primary keys for collection and event reads,
include a thousands-of-events tail replay regression, and cover the bounded SQL
read path.

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
- ❌ Do NOT apply event replay limits after row materialization; the prepared
  statement carries `LIMIT ?`.
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
- **Q:** How does the `kv.version` column reach an already-created database?
  **A:** Guard the `ALTER TABLE` with `PRAGMA table_info`. _Rationale:_ SQLite
  cannot `ADD COLUMN IF NOT EXISTS`, so boot inspects the existing columns and
  only alters when `version` is missing — idempotent across reopens, with a
  `DEFAULT 1` backfilling pre-existing rows. _Rejected:_ dropping/recreating
  `kv`, which would lose persisted collections.

## Referenced by

[[storage-index]] · [[storage]] · [[workspace-memory-records]] · [[Storage]] ·
[[src/_MOC]]
