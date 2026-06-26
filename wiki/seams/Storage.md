---
type: seam
capacity: CRITICAL
capacity_score: 6
lifecycle: CRITICAL
drift_score: 0
drift_status: HEALTHY
production_adapters: 1
change_freq_per_quarter: 1
tags: [seam, critical]
aliases: [Storage, StorageLayer]
---

# Storage (seam)

## Classification
CRITICAL — single production adapter on a core path; every domain service depends
on it, so its failure is system failure. One production adapter today
(InMemory); SQLite is the confirmed second adapter (spec §17), which will promote
this toward BACKBONE once code-complete.

> Capacity 6, not BACKBONE yet: only one production adapter exists. The seam is
> designed for two from day one because the spec commits to SQLite — this is the
> rare case where a second adapter is contractually certain, justifying the
> abstraction now rather than at the second-adapter rule.

## Interface
A keyed, append-aware persistence port. Pure interface (`Context.Tag`), no Effect
construction leaked. Returns `Option` for absence, typed `StorageError` on failure.
Operations: `put`, `get`, `list` (by workspace), `delete`, and `append`/`readAfter`
for the ordered [[Event]] log.

## Adapters
| Adapter | Type | Path | Last verified | Status |
|---------|------|------|---------------|--------|
| InMemory | production | @root/src/infrastructure/storage/in-memory-store.ts | PENDING | PLANNED |
| SQLite | production | @root/src/infrastructure/storage/sqlite-store.ts | — | FUTURE (v0.1 §17) |
| Stub | test | (reuses InMemory) | — | — |

## Health
DRIFT 0 (HEALTHY). Designed, not yet implemented.

## Deepening
ADR: [[ADR-0001-architecture-foundation]].

## Referenced by
[[WorkUnit]] · [[Event]] · [[architecture/_MOC]]
