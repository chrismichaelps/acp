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
   -- promoted, indexed scoping columns (one per [[index-columns]] INDEXED_FIELDS),
   -- each GENERATED ALWAYS AS (value->>'<field>') STORED
   workspace_id text, work_id text, state text, assigned_to text,
   priority text, holder text, kind text,
   PRIMARY KEY(collection, id))
-- kv_collection_workspace(collection, workspace_id)
-- kv_collection_workspace_state(collection, workspace_id, state)
-- kv_collection_work(collection, work_id)
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

The promoted scoping columns (`workspace_id`, `work_id`, `state`, …) are added on
boot, one per [[index-columns]] `INDEXED_FIELDS` entry, as
`GENERATED ALWAYS AS (value->>'<field>') STORED` columns. Unlike [[sqlite-store]]
and [[in-memory-store]] — which populate/derive the columns in application code —
Postgres computes them itself from the jsonb `value` on every insert and update, so
there is **no write-path change** and the columns can never drift from `value`.
Three composite indexes back the hot scoped reads. `queryBy` serves an indexed
`SELECT`.

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

`queryBy` validates every filter `field` against the [[index-columns]]
`INDEXED_FIELDS` allowlist (unknown field → `StorageError` before any query), then
composes `sql.and([...])` over `collection = ${collection}` plus one
`sql`${sql(field)} = ${value}`` predicate per filter — the field is rendered as a
quoted identifier from the validated allowlist, the value stays a bound parameter,
so there is no injection surface. Rows come back ordered by `id` with an optional
`LIMIT`, mapped to their `value`. Verified live against Postgres 16 (generated
columns, value-rewrite reprojection, limit, and allowlist rejection all pass).

## Negative Logic (Prohibited Paths)

- ❌ Do NOT allocate event or memory sequence numbers outside Postgres.
- ❌ Do NOT fetch unbounded event history when a replay limit was supplied.
- ❌ Do NOT decode persisted JSON ad hoc; every event and memory row passes
  through its protocol schema.
- ❌ Do NOT collapse this adapter into SQLite conditionals; the two durable
  adapters prove the [[Storage]] seam.
- ❌ Do NOT hand-populate the promoted columns on writes; they are
  `GENERATED ALWAYS AS ... STORED` and Postgres owns them — writing them would
  raise a generated-column error.
- ❌ Do NOT interpolate a `queryBy` filter field without first validating it
  against `INDEXED_FIELDS`; values are always bound, never string-built.

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
- **Q:** SQLite populates promoted columns in application code on every write;
  why does Postgres use `GENERATED ALWAYS AS ... STORED` instead of the same
  approach? **A:** Postgres can derive the column from the jsonb `value` itself,
  so making the database own it removes the write-path change entirely and makes
  drift structurally impossible — there is no code path that could set the column
  inconsistently with `value`. SQLite's `node:sqlite` generated-column support is
  less uniform across the writes we need, so that adapter derives columns in code
  via `extractIndexColumns`; both reach the same observable contract. _Rejected:_
  mirroring SQLite's manual population here, which would add avoidable write code
  and a drift risk Postgres can eliminate by construction.

## Referenced by

[[storage-index]] · [[storage]] · [[Storage]] · [[src/_MOC]]
