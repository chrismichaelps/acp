---
type: module
path: '@root/src/domain/workers/index.ts'
fidelity: Active
domain: '[[Worker]]'
grammar: '[[grammar/typescript]]'
depth_score: 0.5
depth_status: MEDIUM
tags: [module]
aliases: [worker-service-index]
---

# Worker Barrel

## Purpose

Opaque public entry point for the Worker domain service. Callers import
`WorkerService` and `WorkerServiceLive` from here rather than reaching into
implementation files.

## Interface

### Signatures

```typescript
export * from './worker-service.js'
```

### Linkage

- **Requires:** [[worker-service]]
- **Consumed by:** future transport and application wiring.

## Algorithm

No behavior. Re-export-only module enforcing the Export Law from
[[grammar/typescript]].

## Negative Logic (Prohibited Paths)

- ❌ Do NOT add runtime construction here.

## Depth

MEDIUM (0.5). Aggregates the Worker domain surface.

## Referenced by

[[workers/_MOC]] · [[src/_MOC]]
