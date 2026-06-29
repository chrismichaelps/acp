---
type: module
path: '@root/src/infrastructure/platform-node/index.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.45
depth_status: SHALLOW
tags: [module, seam]
aliases: [platform-node-index]
---

# Platform Node Barrel

## Purpose

Opaque public entry point for Node-specific platform adapters. Application
entrypoints import Node Layers from here instead of constructing Node resources
inline.

## Interface

### Signatures

```typescript
export * from './node-http-server.js'
```

### Linkage

- **Requires:** [[node-http-server]]
- **Consumed by:** [[server-main]] and real-socket server tests.

## Algorithm

No behavior. Re-export-only module enforcing the Export Law from
[[grammar/typescript]].

## Negative Logic (Prohibited Paths)

- ❌ Do NOT import domain services here.
- ❌ Do NOT launch Layers here.

## Depth

SHALLOW (0.45). Aggregates Node platform adapters behind a stable import path.

## Referenced by

[[platform-node/_MOC]] · [[src/_MOC]]
