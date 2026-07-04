---
type: module
path: '@root/src/infrastructure/events/pg-notify-event-broker.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
depth_score: 0.7
depth_status: DEEP
tags: [module, deep]
aliases: [pg-notify-event-broker, PgNotifyEventBroker]
---

# Pg Notify Event Broker

## Purpose

Postgres `LISTEN/NOTIFY` implementation of the domain [[EventBroker]] seam. It
lets separate ACP host processes receive live event fan-out without adding Redis
or another queue dependency.

## Interface

```typescript
export const makePgNotifyEventBrokerLive: (
  url: string,
) => Layer.Layer<EventBroker, StorageError, Storage>
```

## Algorithm

`publish(event)` sends a small JSON pointer over the `acp_events` channel:
`{ workspace_id, seq }`. The full event is not sent through NOTIFY because
Postgres notification payloads are size-limited and ACP events may grow with
domain metadata. `subscribe()` listens to the same channel, parses the pointer,
and re-reads the persisted event from [[storage]] using
`readEventsAfter(workspace_id, seq - 1)`, returning only the matching sequence.
Malformed notifications and lookup failures are logged and dropped from the live
stream; replay remains available through the persisted event log.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT send full events through NOTIFY.
- ❌ Do NOT make NOTIFY the source of truth; [[storage]] remains authoritative.
- ❌ Do NOT fail the event append path because notification fan-out failed after
  persistence.

## Depth

DEEP (0.7). This adapter makes live events cross-process while keeping event
durability and replay in the storage layer.

## Referenced by

[[event-broker-live]] · [[infrastructure/events/_MOC]]
