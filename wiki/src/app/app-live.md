---
type: module
path: '@root/src/app/app-live.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
depth_score: 0.71
depth_status: DEEP
tags: [module, deep]
aliases: [app-live, AppLive]
---

# App Live

## Purpose

Compose the in-memory ACP application dependency graph. This module connects
[[app-config]], [[storage]], [[event-store]], and every domain service into a
single `AppLive` Layer that server and CLI entrypoints can provide.

## Interface

```typescript
export const AppLive: Layer.Layer<
  | AppConfigTag
  | Storage
  | EventStore
  | WorkUnitService
  | WorkerService
  | WorkspaceService
  | LeaseService
  | ArtifactService
  | CheckpointService
  | ReviewService
>
```

## Algorithm

Build storage and config first. Provide [[event-store]] from [[in-memory-store]].
Provide each domain service with the storage/event/config dependencies it needs.
Provide [[review-service]] from [[work-unit-service]] because review outcomes are
coupled to WorkUnit state transitions. Merge the resulting services into one
Layer.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT bind an HTTP port here; that belongs in a future server entrypoint.
- ❌ Do NOT introduce hidden global singletons.
- ❌ Do NOT read `process.env` directly; configuration flows through
  [[app-config]].

## Depth

DEEP (0.71). The module hides Effect Layer wiring and dependency order behind one
application surface. Deleting it would force each entrypoint to reassemble the
same graph manually.

## Grill Log

- **Q:** Should this slice start a server?
  **A:** No. Handler/server wiring is a separate transport slice. This module
  composes the dependency graph without opening sockets, so it can be tested
  deterministically.

## Referenced by

[[app/_MOC]] · [[src/_MOC]]
