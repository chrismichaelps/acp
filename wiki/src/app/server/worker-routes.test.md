---
type: module
path: '@root/src/app/server/worker-routes.test.ts'
fidelity: Active
domain: '[[Worker]]'
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, server, worker]
aliases: [worker-routes.test]
---

# Worker Route Tests

## Purpose

Pin [[worker-routes]] host-scoped list/get behavior, permission enforcement, and
missing-worker semantics without introducing workspace coupling.

## Interface

Vitest suite over the in-process [[acp-router]] using a registered busy worker
and scoped bearer sessions.

## Algorithm

Initialize the worker with `worker:read`, list the registry, and require its id
and busy status. Read the same worker by id. With an authenticated session lacking
the scope, require list to return 403. With the read scope, require an unknown id
to return 404.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT require a workspace id for host-scoped worker presence.
- ❌ Do NOT expose worker registry reads without `worker:read` when authenticated.
- ❌ Do NOT return an empty object or list for an unknown worker id.
- ❌ Do NOT project presence as workspace event history.

## Grill Log

- **Q:** Why preserve the worker status in list and get assertions? **A:** The
  registry is the canonical current-presence surface; identity without status
  would not prove the route fulfills that purpose. _Rejected:_ id-only smoke.

## Referenced by

[[worker-routes]] · [[worker-service]] · [[server/_MOC]] ·
[[ADR-0005-worker-presence-scope]] · [[Transport]] · [[src/_MOC]]
