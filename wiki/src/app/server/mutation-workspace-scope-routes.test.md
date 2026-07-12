---
type: module
path: '@root/src/app/server/mutation-workspace-scope-routes.test.ts'
fidelity: Active
domain: '[[Workspace]]'
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, app, server, auth, tenancy]
aliases: [mutation-workspace-scope-routes.test]
---

# Mutation Workspace Scope Route Tests

## Purpose

Prove [[resource-workspace-auth]] rejects cross-tenant by-id mutations even when
the bearer possesses every required action scope.

## Interface

Vitest integration suite over the in-process [[acp-router]] using separate owner
and attacker sessions bound to different workspaces.

## Algorithm

Create resources in `workspace_1`, then use a `workspace_2` bearer with matching
action scopes. Require 403 for work claim/update/event publication; lease
renew/release/revoke; artifact update/delete; review request over foreign work;
and approve/reject/request-changes/cancel over a foreign review. Every denial
asserts the canonical `forbidden` code.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT treat action permission as sufficient without workspace ownership.
- ❌ Do NOT trust a mutation body to declare the tenant of an id-keyed resource.
- ❌ Do NOT mutate before loading the resource and authorizing its workspace.
- ❌ Do NOT cover one resource family and infer safety for the others.
- ❌ Do NOT return success or not-found for an existing cross-tenant target.

## Grill Log

- **Q:** Why give the attacker every action scope? **A:** It isolates tenant
  binding as the denial reason and proves permission vocabulary cannot bypass
  ownership. _Rejected:_ low-permission fixtures that only test ordinary scope
  denial.

## Referenced by

[[resource-workspace-auth]] · [[route-support]] · [[acp-router]] ·
[[server/_MOC]] · [[Workspace]] · [[Transport]] · [[src/_MOC]]
