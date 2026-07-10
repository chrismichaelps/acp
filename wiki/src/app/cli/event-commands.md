---
type: module
path: '@root/src/app/cli/event-commands.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.5
depth_status: MEDIUM
tags: [module, medium]
aliases: [cli-event-commands]
---

# CLI Event Commands

## Purpose

Own the `events` CLI command map consumed by [[cli-commands]]. Keeping event
replay and streaming handlers in their own module lets the top-level parser stay
as a stable dispatcher while transport features continue to grow.

## Interface

```typescript
export const eventCommandHandlers: Readonly<Record<string, CommandHandler>>
```

`events list --workspace <id> [--after <seq>] [--limit <n>]
[--type <event_type>]` maps to `GET /v1/events?workspace_id=&after_seq=`, adds a
server-side `limit` query when supplied, and records a client-side `type` filter
for [[cli-client]] when `--type` is supplied. `events stream --workspace <id>`
maps to `GET /v1/events/stream?workspace_id=` and sets `stream: true`.

## Algorithm

Both handlers require `--workspace` and URL-encode it into a query parameter.
`events list` defaults `--after` to `0`, validates any provided cursor as a
non-negative safe integer, validates `--limit` as a positive safe integer, and
may add a `type` client filter so agents can print a narrow event class into
context. `--limit` is server-side because event replay can be large; `--type`
remains client-side because event payload typing is still open.
`events stream` marks the request as streaming so [[cli-main]] can keep the
response open instead of routing it through the normal one-shot client.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT parse process arguments here; receive `Parsed` from [[cli-commands]].
- ❌ Do NOT open SSE or HTTP streams here; return `CliRequest` data only.
- ❌ Do NOT filter event responses here; [[cli-client]] applies client filters
  after fetch.

## Depth

MEDIUM (0.5). This is a narrow feature command map, but splitting it keeps event
transport semantics isolated from the central command registry.

## Referenced by

[[event-commands.test]] · [[cli-commands]] · [[cli/_MOC]]
