---
type: module
path: '@root/src/infrastructure/http/index.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.5
depth_status: MEDIUM
tags: [module, seam]
aliases: [http-index]
---

# HTTP Barrel

## Purpose

Opaque public entry point for HTTP infrastructure. Callers import the API
declaration and error mapper from here rather than deep-importing implementation
files.

## Interface

### Signatures

```typescript
export * from './acp-http-api.js'
export * from './http-error-mapper.js'
```

### Linkage

- **Requires:** [[acp-http-api]], [[http-error-mapper]]
- **Consumed by:** future server app wiring.

## Algorithm

No behavior. Re-export-only module enforcing the Export Law from
[[grammar/typescript]].

## Negative Logic (Prohibited Paths)

- ❌ Do NOT add runtime server construction here.

## Depth

MEDIUM (0.5). Aggregates the HTTP infrastructure surface.

## Referenced by

[[http/_MOC]] · [[src/_MOC]]
