---
type: module
path: '@root/src/domain/events/event-store.ts'
fidelity: Active
domain: '[[Event]]'
grammar: '[[grammar/typescript]]'
seam: '[[Storage]]'
depth_score: 0.74
depth_status: DEEP
tags: [module, deep]
aliases: [event-store, EventStore]
---

# Event Store

## Purpose

The domain service for append-only [[Event]] history. It is the single place that
turns an event draft into a sequenced event, persists it through [[Storage]], and
fans the persisted event out to live subscribers through [[event-broker]].

## Interface

### Signatures

```typescript
export type EventDraft = StorageEventDraft

export interface EventStoreApi {
  readonly append: (draft: EventDraft) => Effect<Event, StorageError>
  readonly readAfter: (
    workspaceId: string,
    afterSeq: number,
  ) => Effect<Chunk<Event>, StorageError>
  readonly subscribe: (
    workspaceId: string,
  ) => Effect<Stream<Event>, never, Scope>
}

export class EventStore extends Context.Tag('EventStore')<
  EventStore,
  EventStoreApi
>() {}
export const EventStoreLive: Layer.Layer<
  EventStore,
  never,
  Storage | EventBroker
>
```

### Governance

- `append` delegates sequence assignment to [[storage]]; callers never set `seq`.
- Live subscribers receive only events whose `workspace_id` matches their
  workspace filter.
- `subscribe` is live-only and scoped. Consumers that need replay first call
  `readAfter`, then acquire the subscription stream for future events.

### Linkage

- **Requires:** [[storage]], [[event-broker]], [[event.schema]], [[protocol-error]]
- **Consumed by:** WorkUnit/Lease/Artifact/Checkpoint/Review services,
  [[event-routes]], and the [[EventStream]] transport adapter.

## Algorithm

1. Resolve [[storage]] and [[event-broker]] from the Layer graph.
2. `append(draft)` calls `Storage.appendEvent(draft.workspace_id, draft)`.
3. After persistence succeeds, publish the returned full event to the broker and
   return it to the caller.
4. `readAfter(workspaceId, seq)` delegates to `Storage.readEventsAfter`.
5. `subscribe(workspaceId)` acquires the broker stream and filters by
   `event.workspace_id`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT publish a draft before storage assigns `seq`.
- ❌ Do NOT swallow `StorageError`; persistence failures must stay typed.
- ❌ Do NOT let one workspace receive another workspace's events.
- ❌ Do NOT encode SSE/HTTP frames here; transport owns wire formatting.

## Depth

DEEP (0.74). One small service hides the persistence-then-fan-out ordering rule.
Deleting it would duplicate event sequencing, storage reads, and live filtering in
each domain service and transport adapter.

## Referenced by

[[event-store-index]] · [[Event]] · [[EventStream]] · [[src/_MOC]]
