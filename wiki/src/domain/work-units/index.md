---
type: module
path: '@root/src/domain/work-units/index.ts'
fidelity: Active
domain: '[[WorkUnit]]'
grammar: '[[grammar/typescript]]'
depth_score: 0.5
depth_status: MEDIUM
tags: [module]
aliases: [work-unit-service-index]
---

# WorkUnit Barrel

## Purpose

Opaque public entry point for the WorkUnit domain service. Callers import
`WorkUnitService`, `WorkUnitServiceLive`, and request types from here rather than
reaching into implementation files.

## Interface

### Signatures

```typescript
export * from './work-unit-service.js'
```

### Linkage

- **Requires:** [[work-unit-service]]
- **Consumed by:** future transport and application wiring.

## Algorithm

No behavior. Re-export-only module enforcing the Export Law from
[[grammar/typescript]].

## Negative Logic (Prohibited Paths)

- ❌ Do NOT add runtime construction here.

## Depth

MEDIUM (0.5). Aggregates the WorkUnit domain surface.

## Referenced by

[[work-units/_MOC]] · [[src/_MOC]]
