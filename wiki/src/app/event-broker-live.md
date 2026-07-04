---
type: module
path: '@root/src/app/event-broker-live.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
depth_score: 0.62
depth_status: MEDIUM
tags: [module, medium]
aliases: [event-broker-live, EventBrokerLive]
---

# Event Broker Live

## Purpose

Select the concrete [[EventBroker]] adapter from [[app-config]]. Local and
single-node hosts keep the in-process broker; replicated Postgres-backed hosts
can choose `pg-notify` so live event subscribers receive fan-out across
processes.

## Interface

```typescript
export const EventBrokerLive: Layer.Layer<
  EventBroker,
  StorageError,
  AppConfigTag | Storage
>
```

## Algorithm

Read `AppConfigTag.eventBroker`. `in-process` returns
`InProcessEventBrokerLive`. `pg-notify` requires `databaseUrl`; when it is absent,
the layer fails with `StorageError(connect)` rather than booting a host that
cannot deliver cross-process notifications. When present, the selector returns
[[pg-notify-event-broker]] over the already-selected [[Storage]] layer.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT read `process.env` directly; broker selection flows through
  [[app-config]].
- ❌ Do NOT select storage here; [[storage-live]] owns the storage adapter.
- ❌ Do NOT silently fall back to in-process when `ACP_EVENT_BROKER=pg-notify` is
  misconfigured.

## Depth

MEDIUM (0.62). This is a small selector layer, but it prevents transport-specific
fan-out from leaking into [[app-live]] or [[event-store]].

## Referenced by

[[app-live]] · [[app/_MOC]]
