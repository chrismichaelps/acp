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

Compose the ACP application dependency graph. This module connects [[app-config]],
[[storage-live]], [[event-broker-live]], [[event-store]], and every domain
service into a single `AppLive` Layer that server and CLI entrypoints can
provide.

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
  | MemoryService
  | ReviewService
>
```

## Algorithm

Build config first, then provide [[storage-live]] from that config so every
service receives the same selected [[Storage]] adapter. Provide
[[event-broker-live]] from the selected storage/config so [[event-store]] receives
the configured fan-out adapter (`in-process` or `pg-notify`). Provide each domain
service with the storage/event/config dependencies it needs. Provide
[[review-service]] from [[work-unit-service]] because review outcomes are coupled
to WorkUnit state transitions. Merge the resulting services into one Layer.
[[memory-service]] is provided from the same [[event-store]] layer as
checkpoints/artifacts so Memory creation can persist records and emit
`memory.created` without transport dependencies.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT bind an HTTP port here; that belongs in a future server entrypoint.
- ❌ Do NOT introduce hidden global singletons.
- ❌ Do NOT read `process.env` directly; configuration flows through
  [[app-config]].
- ❌ Do NOT import concrete storage or broker adapters here; selection lives in
  [[storage-live]] and [[event-broker-live]].

## Depth

DEEP (0.71). The module hides Effect Layer wiring and dependency order behind one
application surface. Deleting it would force each entrypoint to reassemble the
same graph manually.

## Grill Log

- **Q:** Should this slice start a server?
  **A:** No. Handler/server wiring is a separate transport slice. This module
  composes the dependency graph without opening sockets, so it can be tested
  deterministically.
- **Q:** Does SQLite become the default app storage now?
  **A:** No. _Rationale:_ local development and tests stay memory-backed unless
  `ACP_STORAGE_ADAPTER=sqlite` is set; this slice makes persistence opt-in without
  changing the existing host behavior. _Rejected:_ silently switching defaults and
  creating database files for every local test run.

## Referenced by

[[app-live.test]] · [[app/_MOC]] · [[src/_MOC]]
