---
type: module
path: '@root/src/domain/workspaces/index.ts'
fidelity: Active
domain: '[[Workspace]]'
grammar: '[[grammar/typescript]]'
depth_score: 0.5
depth_status: MEDIUM
tags: [module]
aliases: [workspace-service-index]
---

# Workspace Barrel

## Purpose

Opaque public entry point for the Workspace domain service. Callers import
`WorkspaceService` and `WorkspaceServiceLive` from here rather than reaching into
implementation files.

## Interface

### Signatures

```typescript
export * from './workspace-service.js'
```

### Linkage

- **Requires:** [[workspace-service]]
- **Consumed by:** future transport and application wiring.

## Algorithm

No behavior. Re-export-only module enforcing the Export Law from
[[grammar/typescript]].

## Negative Logic (Prohibited Paths)

- ❌ Do NOT add runtime construction here.

## Depth

MEDIUM (0.5). Aggregates the Workspace domain surface.

## Referenced by

[[workspaces/_MOC]] · [[src/_MOC]]
