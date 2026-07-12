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
server-side cursor, type, and replay-limit query parameters.

## Interface

Vitest suite driving event argv through the central [[cli-commands|parseArgs]]
registry.

## Algorithm

Assert `events stream` sets `stream: true` and URL-encodes the workspace query.
Assert `events list` defaults `after_seq` to zero, accepts an explicit cursor,
passes `--type` through as an encoded server query, and sends a positive
`--limit` to the server. Reject zero as an invalid replay limit.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT retain `--type` as a client filter; every transport must receive the
  same server-filtered replay contract.
- ❌ Do NOT omit the deterministic zero replay cursor.
- ❌ Do NOT accept zero or negative replay limits.
- ❌ Do NOT forget the streaming marker on the SSE request.

## Grill Log

- **Q:** Why move type filtering into the query? **A:** Replay semantics must be
  transport-independent; CLI-only narrowing made HTTP/RPC consumers observe a
  different event set. _Rejected:_ preserve the old client-only filter.

## Referenced by

[[cli-event-commands]] · [[cli-commands]] · [[cli-client]] · [[cli/_MOC]] ·
[[src/_MOC]]
