---
type: module
path: '@root/src/app/stdio/index.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.45
depth_status: MEDIUM
tags: [module, app, stdio]
aliases: [stdio-index]
---

# Stdio Barrel

## Purpose

Opaque public entry point for the stdio JSON-RPC bridge. It currently exports the
frame codec used by the Node entrypoint and tests.

## Interface

### Signatures

```typescript
export * from './frames.js'
```

### Linkage

- **Requires:** [[stdio-frames]]
- **Consumed by:** tests and future embedding points.

## Algorithm

No behavior. Re-export-only module enforcing the Export Law from
[[grammar/typescript]].

## Negative Logic (Prohibited Paths)

- ❌ Do NOT read from `process.stdin` or write to `process.stdout` here.

## Depth

MEDIUM (0.45). Aggregates the stdio adapter surface.

## Referenced by

[[stdio/_MOC]] · [[Transport]] · [[src/_MOC]]
