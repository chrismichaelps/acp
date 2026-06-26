---
type: module
path: '@root/src/domain/events/index.ts'
fidelity: Active
domain: '[[Event]]'
grammar: '[[grammar/typescript]]'
depth_score: 0.5
depth_status: MEDIUM
tags: [module]
aliases: [event-store-index]
---

# Events Barrel

## Purpose

Opaque public entry point for the events domain service. Callers import
`EventStore`, `EventStoreLive`, and `EventDraft` from here rather than reaching
into the implementation file.

## Interface

### Signatures

```typescript
export * from './event-store.js'
```

### Linkage

- **Requires:** [[event-store]]
- **Consumed by:** future domain services and transport wiring.

## Algorithm

No behavior. Re-export-only module enforcing the Export Law from
[[grammar/typescript]].

## Negative Logic (Prohibited Paths)

- ❌ Do NOT add runtime construction here.

## Depth

MEDIUM (0.5). Aggregates the events domain surface.

## Referenced by

[[events/_MOC]] · [[src/_MOC]]
