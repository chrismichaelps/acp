---
type: seam
capacity: CRITICAL
capacity_score: 6
lifecycle: CRITICAL
drift_score: 0
drift_status: HEALTHY
production_adapters: 3
change_freq_per_quarter: 1
tags: [seam, critical]
aliases: [Storage, StorageLayer]
---

# Storage (seam)

## Classification

CRITICAL — storage sits on a core path; every domain service depends on it, so its
failure is system failure. Three production adapters now exist (InMemory, SQLite,
and Postgres), all selected by `ACP_STORAGE_ADAPTER`. The Postgres adapter is the
network-durable path for multi-replica hosting (ADR-0008).

> Capacity remains 6, not BACKBONE yet: three adapters share one contract, but the
> seam has not shown sustained multi-adapter change pressure and default wiring is
> still InMemory.

## Interface

A keyed, append-aware persistence port. Pure interface (`Context.Tag`), no Effect
construction leaked. Returns `Option` for absence, typed `StorageError` on failure.
Operations: `put`, `get`, `list`, `remove`, `appendEvent`/`readEventsAfter`
for the ordered per-workspace [[Event]] log, and `pruneEventsBefore` (retention:
delete events older than a cutoff, always sparing each workspace's newest event so
the append `seq` high-water-mark never resets).

## Adapters

| Adapter  | Type       | Path                                                | Last verified | Status   |
| -------- | ---------- | --------------------------------------------------- | ------------- | -------- |
| InMemory | production | @root/src/infrastructure/storage/in-memory-store.ts | 2026-06-25    | CURRENT  |
| SQLite   | production | @root/src/infrastructure/storage/sqlite-store.ts    | 2026-06-27    | VERIFIED |
| Postgres | production | @root/src/infrastructure/storage/postgres-store.ts  | 2026-07-03    | VERIFIED |
| Stub     | test       | (reuses InMemory)                                   | —             | —        |

## Health

DRIFT 0 (HEALTHY). InMemory and SQLite adapters are code-complete and tested for
KV roundtrip, list/remove, monotonic per-workspace event seq, workspace isolation,
readEventsAfter, and persistence across reopened SQLite Layer instances. Public
surface in [[storage-index]], interface in [[storage]], adapters in
[[in-memory-store]] and [[sqlite-store]].

## Deepening

ADR: [[ADR-0001-architecture-foundation]].

## Referenced by

[[WorkUnit]] · [[Event]] · [[architecture/_MOC]]
