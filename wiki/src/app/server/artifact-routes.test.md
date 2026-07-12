---
type: module
path: '@root/src/app/server/artifact-routes.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, server, artifact]
aliases: [artifact-routes.test]
---

# Artifact Route Tests

## Purpose

Pin the inline [[acp-router]] artifact transport contract for external evidence,
write validation, identity-preserving updates, and idempotency-visible deletion.

## Interface

Vitest suite over the in-process router with scoped sessions and real
[[artifact-service]] composition.

## Algorithm

Create a `pull_request` artifact backed by an external URI and require HTTP 201.
Reject create when both content and URI are absent. Create inline evidence,
update kind/summary/content, and require id, URI, creator, and creation timestamp
to remain unchanged. Delete the artifact, return its identity at 200, then require
a repeated delete to return 404.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT accept an evidence record with neither inline content nor URI.
- ❌ Do NOT remint artifact identity or creation provenance during update.
- ❌ Do NOT hide a repeated delete behind a false successful no-op.
- ❌ Do NOT bypass `artifact:create|update|delete` bearer scopes.

## Grill Log

- **Q:** Why require 404 on repeated delete? **A:** ACP coordinates evidence
  ownership; callers must distinguish a successful deletion from an already
  missing record. _Rejected:_ transport-level silent idempotency that erases
  state knowledge.

## Referenced by

[[acp-router]] · [[artifact-service]] · [[server/_MOC]] · [[Transport]] ·
[[src/_MOC]]
