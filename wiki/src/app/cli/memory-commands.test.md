---
type: module
path: '@root/src/app/cli/memory-commands.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, cli, memory]
aliases: [cli-memory-commands.test, memory-commands.test]
---

# CLI Memory Command Tests

## Purpose

Pin [[cli-memory-commands]] create payloads, label defaults, list-query
normalization, and required-field rejection.

## Interface

Vitest suite driving memory argv through the central [[cli-commands|parseArgs]]
registry.

## Algorithm

Create memory with optional work identity and trimmed CSV labels, then prove
omitted labels become an empty array. List by encoded workspace with default
`after_seq=0`, and append only supplied cursor, limit, and kind filters. Reject a
create request missing required content fields.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT omit the stable empty label list from create payloads.
- ❌ Do NOT emit empty optional list predicates.
- ❌ Do NOT leave query values unencoded.
- ❌ Do NOT produce a request when required create fields are absent.

## Grill Log

- **Q:** Why default labels to `[]` instead of omission? **A:** Memory creation
  has a stable collection shape, while list filters remain presence-sensitive.
  _Rejected:_ treating write defaults and read predicates identically.

## Referenced by

[[cli-memory-commands]] · [[cli-commands]] · [[cli/_MOC]] · [[Transport]] ·
[[src/_MOC]]
