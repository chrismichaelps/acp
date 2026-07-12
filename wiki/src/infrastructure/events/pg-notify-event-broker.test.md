---
type: module
path: '@root/src/infrastructure/events/pg-notify-event-broker.test.ts'
fidelity: Active
domain: '[[Event]]'
grammar: '[[grammar/typescript]]'
seam: '[[EventStream]]'
tags: [module, test, infrastructure, events, postgres]
aliases: [pg-notify-event-broker.test]
---

# Pg Notify Event Broker Tests

## Purpose

Prove that [[pg-notify-event-broker]] delivers a persisted event across the live
Postgres `LISTEN/NOTIFY` boundary without treating the notification payload as
the durable event record.

## Interface

Database-gated Vitest integration suite over live Postgres [[Storage]] and
[[EventBroker]] layers. It runs only when `ACP_TEST_DATABASE_URL` is present.

## Algorithm

Truncate the shared test tables, subscribe before publishing, append a typed
`work.progressed` event to storage, publish its pointer, join the subscription
fiber, and require the observed event to equal the persisted record exactly.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT run the integration against a fabricated database URL.
- ❌ Do NOT publish an event before it has a durable sequence.
- ❌ Do NOT accept pointer delivery without reloading the exact stored event.

## Grill Log

- **Q:** Why skip without `ACP_TEST_DATABASE_URL`? **A:** The contract is real
  cross-connection Postgres fan-out; an in-memory substitute would prove a
  different adapter. _Rejected:_ silently converting this to a unit test.

## Referenced by

[[pg-notify-event-broker]] · [[events/_MOC]] · [[EventStream]] · [[src/_MOC]]
