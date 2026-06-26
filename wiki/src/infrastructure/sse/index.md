---
type: module
path: '@root/src/infrastructure/sse/index.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[EventStream]]'
depth_score: 0.5
depth_status: MEDIUM
tags: [module, seam]
aliases: [sse-index]
---

# SSE Barrel

## Purpose

Opaque public entry point for SSE infrastructure.

## Interface

### Signatures

```typescript
export * from './sse-event-stream.js'
```

### Linkage

- **Requires:** [[sse-event-stream]]
- **Consumed by:** future HTTP handler/server wiring.

## Algorithm

No behavior. Re-export-only module enforcing the Export Law from
[[grammar/typescript]].

## Negative Logic (Prohibited Paths)

- ❌ Do NOT add runtime server construction here.

## Depth

MEDIUM (0.5). Aggregates the SSE infrastructure surface.

## Referenced by

[[sse/_MOC]] · [[src/_MOC]]
