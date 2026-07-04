---
type: module
path: '@root/src/domain/events/event-broker.ts'
fidelity: Active
domain: '[[Event]]'
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.66
depth_status: DEEP
tags: [module, deep]
aliases: [event-broker, EventBroker]
---

# Event Broker

## Purpose

Transport-agnostic live event fan-out seam used by [[event-store]]. It separates
the domain rule "publish after persistence" from the transport used to wake live
subscribers.

## Interface

```typescript
export interface EventBrokerApi {
  readonly publish: (event: Event) => Effect<void>
  readonly subscribe: () => Effect<Stream<Event>, never, Scope>
}
export class EventBroker extends Context.Tag('EventBroker')<
  EventBroker,
  EventBrokerApi
>() {}
export const InProcessEventBrokerLive: Layer.Layer<EventBroker>
```

## Algorithm

The in-process adapter constructs one unbounded `PubSub<Event>`. `publish`
broadcasts the persisted event to that PubSub, and `subscribe` returns a scoped
firehose stream. Workspace filtering remains in [[event-store]] so concrete
broker adapters only move event notifications.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT publish drafts before [[storage]] assigns event sequence numbers.
- ❌ Do NOT perform workspace filtering inside broker adapters.
- ❌ Do NOT encode SSE/WebSocket frames here; transports own wire formatting.

## Depth

DEEP (0.66). The seam lets ACP swap in cross-process fan-out such as
[[pg-notify-event-broker]] without changing domain services.

## Referenced by

[[event-store]] · [[event-store-index]] · [[event-broker-live]]
