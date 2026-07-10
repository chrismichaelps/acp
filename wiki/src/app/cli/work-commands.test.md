---
type: module
path: '@root/src/app/cli/work-commands.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, cli, work]
aliases: [cli-work-commands.test, work-commands.test]
---

# CLI Work Command Tests

## Purpose

Pin [[cli-work-commands]] list and resume projections, especially ordered
client-side filters and compact resume route encoding.

## Interface

Vitest suite driving work argv through the central [[cli-commands|parseArgs]]
registry.

## Algorithm

Map workspace-scoped work lists, then record state, priority, and assignee as
client filters without changing the route. Assert combined filters preserve argv
order and valueless filter flags are omitted. Map `work resume` to the compact
resume endpoint with an encoded work id.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT convert list filters into unsupported host query parameters.
- ❌ Do NOT materialize a filter whose flag has no value.
- ❌ Do NOT reorder combined filters; output behavior follows request order.
- ❌ Do NOT emit a raw work id in the resume route.

## Grill Log

- **Q:** Does filter order affect matching? **A:** No, but preserving argv order
  keeps the request deterministic and makes printed/debugged intent stable.
  _Rejected:_ sorting filters inside the parser.

## Referenced by

[[cli-work-commands]] · [[cli-commands]] · [[cli-client]] · [[cli/_MOC]] ·
[[src/_MOC]]
