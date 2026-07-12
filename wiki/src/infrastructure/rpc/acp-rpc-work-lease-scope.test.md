---
type: module
path: '@root/src/infrastructure/rpc/acp-rpc-work-lease-scope.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, infrastructure, rpc, auth, work, lease]
aliases: [acp-rpc-work-lease-scope.test]
---

# ACP RPC Work and Lease Scope Tests

## Purpose

Prove [[rpc-resource-workspace-auth]] isolates by-id work and lease reads/
mutations using each stored resource's workspace.

## Interface

Vitest adversarial handler suite with owner and action-permissioned attacker
sessions bound to different workspaces.

## Algorithm

The owner creates protected work and a lease. Require the attacker to receive
`forbidden` for work get/claim/update/progress and lease renew/release/revoke,
even though it holds every requested action scope.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT authorize by-id mutations before loading their workspace.
- ❌ Do NOT treat workspace read scope as cross-tenant read authority.
- ❌ Do NOT mutate the resource before binding denial.

## Grill Log

- **Q:** Why combine work and lease? **A:** Both use the same resource-derived
  authorization seam and represent its core mutable aggregates. _Rejected:_
  inferring lease safety from work-only coverage.

## Referenced by

[[rpc-resource-workspace-auth]] · [[acp-rpc-handlers]] · [[rpc-auth]] ·
[[rpc/_MOC]] · [[Transport]] · [[src/_MOC]]
