---
type: module
path: '@root/src/domain/artifacts/index.ts'
fidelity: Active
domain: '[[Artifact]]'
grammar: '[[grammar/typescript]]'
depth_score: 0.62
depth_status: MEDIUM
tags: [module, medium]
aliases: [artifact-service-index]
---

# Artifact Service Index

## Purpose

Expose the opaque public surface for the [[Artifact]] domain service folder.
Callers import from `src/domain/artifacts/index.ts` rather than reaching into the
implementation file.

## Interface

```typescript
export * from './artifact-service.js'
```

## Algorithm

Re-export the service tag, API types, input type, and live Layer from
[[artifact-service]].

## Negative Logic (Prohibited Paths)

- ❌ Do NOT add construction logic here.
- ❌ Do NOT export storage internals through this barrel.

## Depth

MEDIUM (0.62). The barrel is intentionally small but preserves the folder's
opaque import boundary.

## Referenced by

[[artifacts/_MOC]] · [[src/_MOC]]
