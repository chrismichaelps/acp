---
type: module
path: '@root/src/app/server/sweeper-leadership.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, server, sweeper, leadership]
aliases: [sweeper-leadership.test]
---

# Sweeper Leadership Tests

## Purpose

Pin [[sweeper-leadership]] local execution semantics and fail-fast Postgres
configuration prerequisites.

## Interface

Vitest suite providing leadership adapters under isolated Effect config maps and
inspecting typed startup failure causes.

## Algorithm

Run a value-producing effect under in-process leadership and require
`Option.some(value)`. Select Postgres storage without `ACP_DATABASE_URL`, resolve
the live leadership layer, and require a `StorageError` with operation `connect`
and a precise missing-database diagnostic.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT skip effects under the single-process adapter.
- ❌ Do NOT silently fall back to in-process leadership for Postgres hosts.
- ❌ Do NOT defer missing database configuration until the first sweep tick.
- ❌ Do NOT report a generic defect instead of the typed storage failure.

## Grill Log

- **Q:** Why fail at layer construction? **A:** A replicated host without leader
  election can duplicate expiry side effects; startup refusal is safer than
  degraded execution. _Rejected:_ warning plus unguarded sweeps.

## Referenced by

[[sweeper-leadership]] · [[sweeper]] · [[http-app]] · [[server/_MOC]] ·
[[Transport]] · [[src/_MOC]]
