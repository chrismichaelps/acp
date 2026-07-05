---
type: module
path: '@root/src/infrastructure/storage/postgres-store.ts'
fidelity: Active
domain: '[[Event]]'
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
depth_score: 0.76
depth_status: DEEP
tags: [module, deep, seam]
aliases: [postgres-store, PostgresStorage]
---

# Postgres Storage

## Purpose

Network-durable production adapter behind the [[Storage]] seam. It persists the
generic key-value collections, per-workspace ordered [[Event]] log, and
workspace-scoped [[Memory]] table through `@effect/sql-pg`, giving the HA Docker
profile the same domain contract as [[sqlite-store]] while moving durability and
coordination into Postgres.

## Interface

### Signatures

```typescript
export const makePostgresStorageLive: (
  url: string,
) => Layer.Layer<Storage, StorageError>
export const PostgresStorageLive: Layer.Layer<Storage, StorageError>
```

### Tables

```sql
kv(collection text, id text, value jsonb, version bigint NOT NULL DEFAULT 1,
   PRIMARY KEY(collection, id))
events(workspace_id text, seq bigint, value jsonb, PRIMARY KEY(workspace_id, seq))
event_seq(workspace_id text PRIMARY KEY, next_seq bigint)
memory(workspace_id text, seq bigint, id text, work_id text, kind text, key text,
       labels text[], value jsonb, created_at text,
       PRIMARY KEY(workspace_id, seq), UNIQUE(workspace_id, id))
memory_seq(workspace_id text PRIMARY KEY, next_seq bigint)
```

The event and memory logs are keyed by `(workspace_id, seq)`. Event replay reads
must remain workspace-scoped, cursor-scoped, ordered by `seq`, and bounded with a
SQL `LIMIT` whenever the caller supplies one.

The `kv.version` column is a per-row monotonic counter added idempotently on
boot via `ALTER TABLE kv ADD COLUMN IF NOT EXISTS version bigint NOT NULL
DEFAULT 1`. New rows start at version `1`; every successful write — `put`
upsert, `replaceIf`, and `replaceIfVersion` — bumps it by one, matching
[[in-memory-store]] and [[sqlite-store]] so the three adapters version
identically.

## Algorithm

The Layer runs schema creation before returning the adapter. Generic collection
methods encode values as JSON and operate through the `kv` table. `appendEvent`
uses `event_seq` inside a transaction to allocate a monotonic per-workspace seq,
persists the encoded [[Event]], and returns the typed record. `readEventsAfter`
selects `value` from `events` where the workspace matches and `seq > afterSeq`,
orders ascending, applies the optional limit in SQL, decodes every row through
[[event.schema]], and returns a `Chunk`.

`appendMemory` mirrors event sequence ownership with `memory_seq`; `readMemory`
keeps the existing cursor and optional filters in SQL so thousands of handoff or
recall records do not require application-side scans.

`getVersioned` selects `value, version` and returns both wrapped in an
`Option`. `replaceIfVersion` is an O(1) compare-and-swap — `UPDATE kv SET value
= ..., version = version + 1 WHERE collection = ... AND id = ... AND version =
expectedVersion RETURNING 1 AS one` — succeeding when exactly one row comes
back, avoiding `replaceIf`'s whole-JSONB-blob comparison.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT allocate event or memory sequence numbers outside Postgres.
- ❌ Do NOT fetch unbounded event history when a replay limit was supplied.
- ❌ Do NOT decode persisted JSON ad hoc; every event and memory row passes
  through its protocol schema.
- ❌ Do NOT collapse this adapter into SQLite conditionals; the two durable
  adapters prove the [[Storage]] seam.

## Depth

DEEP (0.76). The adapter hides database schema creation, transactional sequence
allocation, JSONB encoding, row decoding, and hot replay query planning behind
the same storage port used by the in-memory and SQLite adapters.

## Grill Log

- **Q:** How does the `kv.version` column reach an already-created database?
  **A:** `ALTER TABLE kv ADD COLUMN IF NOT EXISTS version bigint NOT NULL
  DEFAULT 1` in `schemaStatements`, run unconditionally on every boot alongside
  the other `CREATE TABLE IF NOT EXISTS` statements. _Rationale:_ Postgres
  supports `ADD COLUMN IF NOT EXISTS` natively, so no separate existence check
  is needed (unlike [[sqlite-store]], whose engine lacks that clause).
  _Rejected:_ a one-off migration script, which would need manual invocation
  outside the adapter's self-contained boot sequence.

## Referenced by

[[storage-index]] · [[storage]] · [[Storage]] · [[src/_MOC]]
