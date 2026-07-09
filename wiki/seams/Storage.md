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

A keyed, append-aware, **queryable** persistence port. Pure interface
(`Context.Tag`), no Effect construction leaked. Returns `Option` for absence,
typed `StorageError` on failure.

Operations:

- KV: `put`, `get`, `getVersioned`, `list`, `queryBy`, `remove`,
  `putIfAbsent`, `replaceIf`, `replaceIfVersion`
- Events: `appendEvent` / `readEventsAfter`, `pruneEventsBefore` (retention:
  delete events older than a cutoff, always sparing each workspace's newest event
  so the append `seq` high-water-mark never resets)
- Memory: `appendMemory` / `readMemory`

Scale-tier additions (Feature 580 / [[ADR-0010-context-exchange-optimization]]
slices 2–3):

- `getVersioned` / `replaceIfVersion` — monotonic per-row `version` for O(1) CAS
  instead of full-blob equality
- `queryBy(collection, filters, opts?)` — equality predicates over promoted
  indexed columns (`workspace_id`, `work_id`, `state`, `assigned_to`,
  `priority`, `holder`, `kind`, `review_id`, `grill_id`); returns values ordered
  by `id`, optional `limit`; unknown filter field → `StorageError`

## Adapters

| Adapter  | Type       | Path                                                | Last verified | Status   |
| -------- | ---------- | --------------------------------------------------- | ------------- | -------- |
| InMemory | production | @root/src/infrastructure/storage/in-memory-store.ts | 2026-07-09    | CURRENT  |
| SQLite   | production | @root/src/infrastructure/storage/sqlite-store.ts    | 2026-07-09    | VERIFIED |
| Postgres | production | @root/src/infrastructure/storage/postgres-store.ts  | 2026-07-09    | VERIFIED |
| Stub     | test       | (reuses InMemory)                                   | —             | —        |

## Health

DRIFT 0 (HEALTHY). All three adapters implement version-column CAS and indexed
`queryBy` with shared [[index-columns]] allowlist. Conformance suite
(`query-conformance.test.ts`) asserts InMemory ↔ SQLite parity for filter
ordering/limit/predicate and stale-version CAS; Postgres is covered by its
connection-guarded store test. Domain scoped reads (work-units, artifacts,
checkpoints, leases, reviews `listForWork`) use `queryBy` — O(log N + k) instead
of full-collection scan. Host-scoped registries (workspaces, workers, sessions)
and review `listForWorkspace` (join through work; reviews lack `workspace_id`)
correctly keep `storage.list`. Public surface in [[storage-index]], interface in
[[storage]], adapters in [[in-memory-store]], [[sqlite-store]], [[postgres-store]].

## Deepening

ADR: [[ADR-0001-architecture-foundation]] · [[ADR-0008-deployment-storage-topology]]
· [[ADR-0010-context-exchange-optimization]] (queryable/indexed port, `version`
CAS, content-addressed blob dedup — Feature 580 scale tier).

## Referenced by

[[WorkUnit]] · [[Event]] · [[architecture/_MOC]]
