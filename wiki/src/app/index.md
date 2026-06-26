---
type: module
path: '@root/src/app/index.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
depth_score: 0.62
depth_status: MEDIUM
tags: [module, medium]
aliases: [app-live-index]
---

# App Index

## Purpose

Expose the application Layer surface for entrypoints. Server and CLI modules
import from `src/app/index.ts` rather than from concrete composition files.

## Interface

```typescript
export * from './app-live.js'
```

## Algorithm

Re-export [[app-live]].

## Negative Logic (Prohibited Paths)

- ❌ Do NOT allocate processes or bind sockets here.
- ❌ Do NOT import Node built-ins here.

## Depth

MEDIUM (0.62). Small by design; it preserves the app folder's import boundary.

## Referenced by

[[app/_MOC]] · [[src/_MOC]]
