---
type: module
path: '@root/src/infrastructure/storage/index.ts'
fidelity: Active
domain: '[[Event]]'
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
depth_score: 0.5
depth_status: MEDIUM
tags: [module, seam]
aliases: [storage-index]
---

# Storage Barrel

## Purpose

Opaque public entry point for the [[Storage]] capability folder. Callers import the
service tag, contract types, and active adapter Layer from here instead of
deep-importing implementation files.

## Interface

### Signatures

```typescript
export * from './storage.js'
export * from './in-memory-store.js'
export * from './sqlite-store.js'
export * from './postgres-store.js'
```

### Linkage

- **Requires:** [[storage]], [[in-memory-store]], [[sqlite-store]],
  [[postgres-store]]
- **Consumed by:** storage tests now; future domain services and app wiring later.

## Algorithm

No behavior. Re-export-only module enforcing the Export Law from
[[grammar/typescript]].

## Negative Logic (Prohibited Paths)

- ❌ Do NOT add construction logic here; keep behavior in adapters.
- ❌ Do NOT make callers import adapter files directly outside adapter tests or app wiring.

## Depth

MEDIUM (0.5). Aggregates the storage seam and its durable adapters without
letting callers import construction files directly.

## Referenced by

[[storage/_MOC]] · [[src/_MOC]]
