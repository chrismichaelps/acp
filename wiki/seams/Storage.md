---
type: seam
capacity: CRITICAL
capacity_score: 6
lifecycle: CRITICAL
drift_score: 0
drift_status: HEALTHY
production_adapters: 2
change_freq_per_quarter: 1
tags: [seam, critical]
aliases: [Storage, StorageLayer]
---

# Storage (seam)

## Classification

CRITICAL — storage sits on a core path; every domain service depends on it, so its
failure is system failure. Two production adapters now exist (InMemory and
SQLite), but the seam is not BACKBONE until both are exercised through host wiring
and change frequency justifies heavier governance.

> Capacity remains 6, not BACKBONE yet: SQLite is verified as an adapter, but
> application wiring still defaults to InMemory and the seam has not shown
> sustained multi-adapter change pressure.

## Interface

A keyed, append-aware persistence port. Pure interface (`Context.Tag`), no Effect
construction leaked. Returns `Option` for absence, typed `StorageError` on failure.
Operations: `put`, `get`, `list`, `remove`, and `appendEvent`/`readEventsAfter`
for the ordered per-workspace [[Event]] log.

## Adapters

| Adapter  | Type       | Path                                                | Last verified | Status   |
| -------- | ---------- | --------------------------------------------------- | ------------- | -------- |
| InMemory | production | @root/src/infrastructure/storage/in-memory-store.ts | 2026-06-25    | CURRENT  |
| SQLite   | production | @root/src/infrastructure/storage/sqlite-store.ts    | 2026-06-27    | VERIFIED |
| Postgres | planned    | (via `@effect/sql-pg`; ADR-0008)                    | —             | PLANNED  |
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
