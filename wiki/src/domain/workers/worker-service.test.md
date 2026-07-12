---
type: module
path: '@root/src/domain/workers/worker-service.test.ts'
fidelity: Active
domain: '[[Worker]]'
grammar: '[[grammar/typescript]]'
tags: [module, test, domain, worker, presence]
aliases: [worker-service.test]
---

# Worker Service Tests

## Purpose

Pin [[worker-service]] registration/readback, reconnect upsert, optional missing
reads, full registry listing, status mutation, and missing-worker errors.

## Interface

Vitest suite over `WorkerServiceLive` and in-memory [[Storage]].

## Algorithm

Register and read a worker. Re-register the same id with `busy` status and
require overwrite. Return `Option.none` for an unknown worker. Register agent and
human identities and list both. Change a stored worker to `offline`; require
`NotFoundError` when updating missing presence.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT reject a reconnect merely because the worker id already exists.
- ❌ Do NOT create a new identity when updating presence.
- ❌ Do NOT treat unknown get as an exceptional failure.
- ❌ Do NOT silently create a worker through `setStatus`.
- ❌ Do NOT impose an ordered lifecycle on presence values.

## Grill Log

- **Q:** Why is register an upsert? **A:** Session initialization repeats on
  reconnect and must refresh current vendor/capabilities/status without a
  separate branch. _Rejected:_ create-only registration.

## Referenced by

[[worker-service]] · [[workers/_MOC]] · [[Worker]] ·
[[ADR-0005-worker-presence-scope]] · [[src/_MOC]]
