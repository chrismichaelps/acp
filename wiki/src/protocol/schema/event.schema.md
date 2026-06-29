---
type: module
path: '@root/src/protocol/schema/event.schema.ts'
fidelity: Active
domain: '[[Event]]'
grammar: '[[grammar/typescript]]'
seam: '[[EventStream]]'
depth_score: 0.72
depth_status: DEEP
tags: [module, deep]
aliases: [event.schema]
---

# Event Schema

## Purpose

Wire + domain shape of an [[Event]] — the append-only workspace coordination
primitive — plus the closed `EventType` vocabulary (spec §10.8, §11).

## Interface

### Signatures

```typescript
export const EventType: Schema.Literal<[ // all spec §11 types
  "worker.online", … "memory.created", … "review.cancelled" ]>
export const Event: Schema.Struct<{
  id: EventId; type: EventType; workspace_id: WorkspaceId
  work_id: optionalWith<WorkId, Option>; actor: WorkerId
  timestamp: Timestamp; seq: number; data: Schema.Record<string, Schema.Unknown>
}>
export type Event = typeof Event.Type
export type EventType = typeof EventType.Type
```

## Algorithm

Struct over [[ids]] + [[common]]. `type` is the authoritative closed union of
draft protocol event names; `workspace_id` and `seq` make persisted records
workspace-scoped and ordered for replay. `data` is an open payload bag (validated
per-type by producing services, not here). Worker presence names are reserved in
the union but not emitted by v0.1 because [[ADR-0005-worker-presence-scope]] keeps
presence host-scoped.

Review events include the full requested-review lifecycle. `review.cancelled` is
the withdrawal signal for an outstanding review gate; it must not be collapsed
into `review.rejected`, because rejection is an explicit reviewer outcome while
cancellation means the gate itself was withdrawn.

Memory events include `memory.created`, emitted after a [[Memory]] record is
persisted. Memory updates/deletes are intentionally absent in v0.1 because
Memory is append-oriented handoff context.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT emit an `Event` whose `type` is outside the `EventType` union.
- ❌ Do NOT mutate an event after creation — events are immutable.
- ❌ Do NOT force host-level worker presence into a fake workspace event.

## Depth

DEEP (0.72). The single `EventType` union governs the whole event system; deleting
it scatters string event-name literals across every service.

## Referenced by

[[EventStream]] · [[Storage]] · [[Memory]] · [[ADR-0005-worker-presence-scope]] ·
[[src/_MOC]]
