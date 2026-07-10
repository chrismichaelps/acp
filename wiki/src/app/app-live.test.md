---
type: module
path: '@root/src/app/app-live.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
tags: [module, test, app, layer]
aliases: [app-live.test]
---

# App Live Tests

## Purpose

Prove [[app-live]] supplies the complete application dependency graph, selects
the configured persistent adapter, and fails closed when a broker prerequisite
is absent.

## Interface

Vitest suite that provides programs with `AppLive` under an isolated Effect
`ConfigProvider`. Temporary SQLite directories are removed after every test.

## Algorithm

Resolve config, storage, event, work, worker, workspace, lease, artifact,
checkpoint, and review services from one composed layer. Register a worker
through a SQLite-backed layer and recover it from a fresh layer using the same
database path. Finally select `pg-notify` without `ACP_DATABASE_URL` and assert
startup exits with a `StorageError` whose operation is `connect`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT replace the fresh-layer SQLite read with an in-memory assertion;
  persistence across layer instances is the contract.
- ❌ Do NOT silently fall back to in-process events when `pg-notify` lacks its
  database URL.
- ❌ Do NOT leave temporary database directories behind after the suite.

## Grill Log

- **Q:** Is resolving service tags enough to prove composition? **A:** No. The
  SQLite roundtrip proves adapter selection and durable state, while the broker
  failure pins fail-fast startup. _Rejected:_ dependency-presence assertions
  alone.

## Referenced by

[[app-live]] · [[app/_MOC]] · [[src/_MOC]]
