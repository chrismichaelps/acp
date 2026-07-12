---
type: module
path: '@root/src/domain/events/event-broker.test.ts'
fidelity: Active
domain: '[[Event]]'
grammar: '[[grammar/typescript]]'
seam: '[[EventStream]]'
tags: [module, test, domain, events, broker]
aliases: [event-broker.test]
---

# Event Broker Tests

## Purpose

Prove [[event-broker]] provides live unfiltered firehose delivery and true
fan-out to every active subscriber.

## Interface

Vitest async suite over `InProcessEventBrokerLive` using scoped streams and
forked `Stream.runHead` consumers.

## Algorithm

Subscribe before publishing and require the observed event equals the published
record. Subscribe twice, publish once, join both fibers, and require both receive
the same event.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT drop an event when a live subscriber already exists.
- ❌ Do NOT load-balance one event to only one subscriber.
- ❌ Do NOT filter by workspace inside the broker seam.
- ❌ Do NOT outlive the subscriber scope.

## Grill Log

- **Q:** Why is this intentionally unfiltered? **A:** Broker adapters move
  notifications; [[event-store]] owns workspace projection consistently across
  in-process and cross-process brokers. _Rejected:_ adapter-specific filtering.

## Referenced by

[[event-broker]] · [[event-store.test]] · [[events/_MOC]] · [[EventStream]] ·
[[src/_MOC]]
