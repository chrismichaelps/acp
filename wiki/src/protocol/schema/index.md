---
type: module
path: '@root/src/protocol/schema/index.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
depth_score: 0.5
depth_status: MEDIUM
tags: [module]
aliases: [schema-index]
---

# Schema Barrel

## Purpose

Single opaque entry point re-exporting every protocol schema namespace, so callers
import `from "../protocol/schema/index.js"` rather than reaching into individual files
(Export Law, [[grammar/typescript]]).

## Interface

### Signatures

```typescript
export * from './ids.js'
export * from './common.js'
export * from './worker.schema.js' // …including memory.schema.js and the rest
export * from '../version.js'
```

## Negative Logic (Prohibited Paths)

- ❌ Do NOT deep-import a single schema file from outside `protocol/schema/`.

## Depth

MEDIUM (0.5). Pure aggregation; centralizes the public schema surface.

## Referenced by

[[protocol-version]] · [[src/_MOC]]
