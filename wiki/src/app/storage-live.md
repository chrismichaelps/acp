---
type: module
path: '@root/src/app/storage-live.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
depth_score: 0.62
depth_status: MEDIUM
tags: [module, seam]
aliases: [storage-live, StorageLive]
---

# Storage Live

## Purpose

Select the host [[Storage]] adapter from [[app-config]] so entrypoints can choose
the default in-memory runtime or the file-backed [[sqlite-store]] without changing
domain services.

## Interface

### Signatures

```typescript
export const StorageLive: Layer.Layer<Storage, StorageError, AppConfigTag>
```

### Linkage

- **Requires:** [[app-config]], [[in-memory-store]], [[sqlite-store]]
- **Consumed by:** [[app-live]]

## Algorithm

Read `config.storageAdapter`. If it is `sqlite`, return
`makeSqliteStorageLive(config.sqlitePath)`; otherwise return
`InMemoryStorageLive`. `Layer.unwrapEffect` keeps selection effectful while the
result remains a normal `Layer`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT let domain services choose storage adapters.
- ❌ Do NOT read environment variables here; use [[app-config]].
- ❌ Do NOT make SQLite the implicit default; local tests and development remain
  memory-backed unless configured.

## Depth

MEDIUM (0.62). Small but valuable composition seam: it isolates adapter selection
from the application graph and keeps persistent storage a configuration decision.

## Referenced by

[[app-live]] · [[Storage]] · [[src/_MOC]]
