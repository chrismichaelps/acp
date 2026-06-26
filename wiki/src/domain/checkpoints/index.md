---
type: module
path: '@root/src/domain/checkpoints/index.ts'
fidelity: Active
domain: '[[Checkpoint]]'
grammar: '[[grammar/typescript]]'
depth_score: 0.62
depth_status: MEDIUM
tags: [module, medium]
aliases: [checkpoint-service-index]
---

# Checkpoint Service Index

## Purpose

Expose the opaque public surface for the [[Checkpoint]] domain service folder.

## Interface

```typescript
export * from './checkpoint-service.js'
```

## Algorithm

Re-export the service tag, API types, input type, and live Layer from
[[checkpoint-service]].

## Negative Logic (Prohibited Paths)

- ❌ Do NOT add construction logic here.
- ❌ Do NOT export storage internals through this barrel.

## Depth

MEDIUM (0.62). The barrel preserves the folder's opaque import boundary.

## Referenced by

[[checkpoints/_MOC]] · [[src/_MOC]]
