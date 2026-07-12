---
type: module
path: '@root/src/domain/events/event-store.test.ts'
fidelity: Active
domain: '[[Event]]'
grammar: '[[grammar/typescript]]'
seam: '[[EventStream]]'
tags: [module, test, domain, events, storage]
aliases: [event-store.test]
---

# Event Store Tests

## Purpose

Pin [[event-store]] persistence sequencing, cursor replay, empty history, and
workspace-filtered live projection over the unfiltered broker.

## Interface

Vitest sync/async suite over `EventStoreLive`, in-memory [[Storage]], and
`InProcessEventBrokerLive`.

## Algorithm

Append two drafts in one workspace and require assigned sequence numbers 1 and 2. Replay after sequence 1 and require only the second persisted event; return
an empty chunk for an unknown workspace. Subscribe to one workspace, append an
event for another and then the target, and require only the target event reaches
the subscriber.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT publish drafts before storage assigns sequence numbers.
- ❌ Do NOT treat sequence as global across unrelated workspace reads.
- ❌ Do NOT leak another workspace's live event to a scoped subscriber.
- ❌ Do NOT fail an empty replay.

## Grill Log

- **Q:** Why append a foreign event before the expected live event? **A:** It
  proves filtering rather than mere eventual delivery. _Rejected:_ single-event
  subscription smoke that cannot detect cross-workspace leakage.

## Referenced by

[[event-store]] · [[event-broker.test]] · [[events/_MOC]] · [[Event]] ·
[[EventStream]] · [[src/_MOC]]
