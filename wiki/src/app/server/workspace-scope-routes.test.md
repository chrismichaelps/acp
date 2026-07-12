---
type: module
path: '@root/src/app/server/workspace-scope-routes.test.ts'
fidelity: Active
domain: '[[Workspace]]'
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, server, auth, tenancy]
aliases: [workspace-scope-routes.test]
---

# Workspace Scope Route Tests

## Purpose

Prove direct workspace-bearing HTTP mutations honor session bindings for work,
artifact, and checkpoint creation.

## Interface

Vitest integration suite over the in-process [[acp-router]] with sessions bound
to explicit workspace id sets.

## Algorithm

Create work inside the session's bound workspace and require HTTP 201 plus the
same workspace id. Attempt work creation in another workspace and require 403
`forbidden`. Repeat the cross-binding denial for artifact creation and checkpoint
creation under their correct action scopes.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT authorize direct workspace-bearing payloads by action scope alone.
- ❌ Do NOT infer workspace from an arbitrary work id when the body already owns
  the authoritative workspace field.
- ❌ Do NOT let artifact or checkpoint evidence cross the tenant boundary.
- ❌ Do NOT deny a mutation inside an explicitly bound workspace.

## Grill Log

- **Q:** How does this differ from by-id mutation coverage? **A:** These routes
  carry workspace directly in the request body, while
  [[mutation-workspace-scope-routes.test]] proves derived ownership for existing
  ids. _Rejected:_ treating either path as coverage for both authorization modes.

## Referenced by

[[route-support]] · [[acp-router]] ·
[[mutation-workspace-scope-routes.test]] · [[server/_MOC]] · [[Workspace]] ·
[[Transport]] · [[src/_MOC]]
