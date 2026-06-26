---
type: module
path: '@root/src/app/server/index.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
depth_score: 0.5
depth_status: MEDIUM
tags: [module]
aliases: [server-index]
---

# Server Barrel

## Purpose

Opaque public surface for the HTTP server: re-exports [[acp-router]] and
[[id-clock]]. Excludes [[server-main]] (a side-effecting entrypoint).

## Interface

### Signatures

```typescript
export * from './identity.js'
export * from './router.js'
```

### Linkage

- **Requires:** [[acp-router]], [[id-clock]]
- **Consumed by:** [[server-main]] and server tests.

## Algorithm

No behavior. Re-export-only module enforcing the Export Law from
[[grammar/typescript]].

## Negative Logic (Prohibited Paths)

- ❌ Do NOT re-export [[server-main]] — it runs a server on import.

## Depth

MEDIUM (0.5). Aggregates the server surface.

## Referenced by

[[server/_MOC]] · [[src/_MOC]]
