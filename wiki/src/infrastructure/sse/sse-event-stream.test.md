---
type: module
path: '@root/src/infrastructure/sse/sse-event-stream.test.ts'
fidelity: Active
domain: '[[Event]]'
grammar: '[[grammar/typescript]]'
seam: '[[EventStream]]'
tags: [module, test, infrastructure, sse, event]
aliases: [sse-event-stream.test]
---

# SSE Event Stream Tests

## Purpose

Prove [[sse-event-stream]] typed-event framing, UTF-8 stream encoding, streaming
HTTP response metadata, and idle heartbeat syntax.

## Interface

Vitest suite over a schema-decoded [[Event]], Effect streams, and SSE response
helpers.

## Algorithm

Encode a `work.claimed` event and require its event name, JSON identifiers, and
double-newline terminator. Convert a one-event stream to bytes and recover its
text. Build a response and require status 200, stream body, and SSE content type.
Require the heartbeat to be the exact SSE comment `: heartbeat\n\n`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT omit the SSE frame terminator.
- ❌ Do NOT lose event sequence or work identity during schema encoding.
- ❌ Do NOT return a buffered/non-stream response body.
- ❌ Do NOT encode heartbeats as domain events or data messages.

## Grill Log

- **Q:** Why is the heartbeat asserted byte-for-byte? **A:** SSE comments keep
  idle connections alive without creating client-visible domain events.
  _Rejected:_ a synthetic heartbeat event type.

## Referenced by

[[sse-event-stream]] · [[sse/_MOC]] · [[EventStream]] · [[src/_MOC]]
