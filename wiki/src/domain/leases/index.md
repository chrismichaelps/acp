---
type: module
path: '@root/src/domain/leases/index.ts'
fidelity: Active
domain: '[[Lease]]'
grammar: '[[grammar/typescript]]'
depth_score: 0.62
depth_status: MEDIUM
tags: [module, medium]
aliases: [lease-service-index]
---

# Lease Service Index

## Purpose

Expose the opaque public surface for the [[Lease]] domain service folder. Callers
import from `src/domain/leases/index.ts` instead of reaching into implementation
files directly.

## Interface

```typescript
export * from './lease-service.js'
```

## Algorithm

Re-export the service tag, API types, input type, and live Layer from
[[lease-service]]. This matches the [[worker-service-index]],
[[workspace-service-index]], and [[work-unit-service-index]] folder pattern.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT add construction logic here.
- ❌ Do NOT export storage internals through this barrel.

## Depth

MEDIUM (0.62). The barrel is intentionally shallow but enforces the folder's
opaque import boundary.

## Referenced by

[[leases/_MOC]] · [[src/_MOC]]
