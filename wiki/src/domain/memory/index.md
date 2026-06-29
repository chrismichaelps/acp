---
type: module
path: '@root/src/domain/memory/index.ts'
fidelity: Active
domain: '[[Memory]]'
grammar: '[[grammar/typescript]]'
depth_score: 0.65
depth_status: MEDIUM
tags: [module, medium]
aliases: [memory-service-index]
---

# Memory Service Index

## Purpose

Opaque barrel for the [[Memory]] domain service. Callers import from the folder
index rather than reaching into implementation files.

## Interface

```typescript
export * from './memory-service.js'
```

## Negative Logic (Prohibited Paths)

- ❌ Do NOT export test helpers or private storage details.

## Referenced by

[[memory/_MOC]] · [[src/_MOC]]
