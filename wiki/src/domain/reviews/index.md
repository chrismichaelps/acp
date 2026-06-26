---
type: module
path: '@root/src/domain/reviews/index.ts'
fidelity: Active
domain: '[[Review]]'
grammar: '[[grammar/typescript]]'
depth_score: 0.62
depth_status: MEDIUM
tags: [module, medium]
aliases: [review-service-index]
---

# Review Service Index

## Purpose

Expose the opaque public surface for the [[Review]] domain service folder.

## Interface

```typescript
export * from './review-service.js'
```

## Algorithm

Re-export the service tag, API types, input type, and live Layer from
[[review-service]].

## Negative Logic (Prohibited Paths)

- ❌ Do NOT add construction logic here.
- ❌ Do NOT export storage internals through this barrel.

## Depth

MEDIUM (0.62). The barrel preserves the folder's opaque import boundary.

## Referenced by

[[reviews/_MOC]] · [[src/_MOC]]
