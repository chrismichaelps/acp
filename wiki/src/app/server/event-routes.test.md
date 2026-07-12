---
type: module
path: '@root/src/app/server/event-routes.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, server, events]
aliases: [event-routes.test]
---

# Event Route Tests

## Purpose

Prove [[event-routes]] applies replay cursor, server-side type filtering, limit,
scope, workspace binding, and SSE authorization consistently.

## Interface

Vitest suite over the in-process [[acp-router]] using scoped and optionally
workspace-bound sessions.

## Algorithm

Create workspace events and replay after sequence zero, then advance the cursor
past the event and require an empty result. Generate multiple event types and
require unfiltered replay, exact server-side type narrowing, and empty results
for an unknown type. Apply `limit=1` at the route boundary. Reject authenticated
replay without `event:read`, reject a workspace-bound token outside its binding,
and enforce the same scope on the SSE route.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT return the whole log for an unknown event type.
- ❌ Do NOT apply limit only after returning an unbounded replay.
- ❌ Do NOT authorize replay and streaming with different scopes.
- ❌ Do NOT ignore a session's workspace binding on event reads.

## Grill Log

- **Q:** Why test unknown type as empty rather than invalid? **A:** The query is
  intentionally lenient for forward-compatible consumers, but it must never
  degrade to an unfiltered disclosure. _Rejected:_ unknown type returns all.

## Referenced by

[[event-routes]] · [[event-store]] · [[sse-event-stream]] · [[server/_MOC]] ·
[[Transport]] · [[src/_MOC]]
