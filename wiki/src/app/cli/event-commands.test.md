---
type: module
path: '@root/src/app/cli/event-commands.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, cli, events]
aliases: [cli-event-commands.test, event-commands.test]
---

# CLI Event Command Tests

## Purpose

Pin [[cli-event-commands]] replay and streaming request projection, including
server query parameters, client-side type filtering, and replay-limit
validation.

## Interface

Vitest suite driving event argv through the central [[cli-commands|parseArgs]]
registry.

## Algorithm

Assert `events stream` sets `stream: true` and URL-encodes the workspace query.
Assert `events list` defaults `after_seq` to zero, accepts an explicit cursor,
records `--type` as a client filter without changing the host route, and sends a
positive `--limit` to the server. Reject zero as an invalid replay limit.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT send `--type` as an unsupported server query; it is a client-side
  filter.
- ❌ Do NOT omit the deterministic zero replay cursor.
- ❌ Do NOT accept zero or negative replay limits.
- ❌ Do NOT forget the streaming marker on the SSE request.

## Grill Log

- **Q:** Why are type and limit projected differently? **A:** The host owns
  replay bounds, while the current CLI narrows event type after fetch. _Rejected:_
  pretending both flags share server support.

## Referenced by

[[cli-event-commands]] · [[cli-commands]] · [[cli-client]] · [[cli/_MOC]] ·
[[src/_MOC]]
