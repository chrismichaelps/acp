---
type: module
path: '@root/src/domain/sessions/index.ts'
fidelity: Active
domain: '[[Worker]]'
grammar: '[[grammar/typescript]]'
depth_score: 0.5
depth_status: MEDIUM
tags: [module]
aliases: [session-service-index]
---

# Session Barrel

## Purpose

Opaque public entry point for the Session domain service. Callers import
`SessionService` and `SessionServiceLive` from here rather than reaching into
implementation files.

## Interface

### Signatures

```typescript
export * from './session-service.js'
export * from './session-issuer.js'
```

### Linkage

- **Requires:** [[session-service]], [[session-issuer]]
- **Consumed by:** [[app-live]], [[acp-router]].

## Algorithm

No behavior. Re-export-only module enforcing the Export Law from
[[grammar/typescript]].

## Negative Logic (Prohibited Paths)

- ❌ Do NOT add runtime construction here.

## Depth

MEDIUM (0.5). Aggregates the Session domain surface.

## Referenced by

[[sessions/_MOC]] · [[src/_MOC]]
