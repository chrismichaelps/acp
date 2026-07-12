---
type: module
path: '@root/src/infrastructure/rpc/acp-rpc-direct-workspace-scope.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, infrastructure, rpc, auth, workspace]
aliases: [acp-rpc-direct-workspace-scope.test]
---

# ACP RPC Direct Workspace Scope Tests

## Purpose

Pin [[rpc-auth]] direct workspace binding enforcement for evidence, memory, and
event calls whose payload/query explicitly names the workspace.

## Interface

Vitest adversarial handler suite using a fully permissioned session bound to a
different workspace.

## Algorithm

Attempt artifact create/workspace list, checkpoint create/workspace list, memory
create/list, and event replay against the unbound workspace. Require every call
to return typed `forbidden` despite holding its action permission.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT treat action permission as tenant membership.
- ❌ Do NOT omit workspace binding checks from read operations.
- ❌ Do NOT persist cross-workspace evidence before authorization.

## Grill Log

- **Q:** Why include reads and writes? **A:** Tenant isolation protects both
  confidentiality and integrity. _Rejected:_ enforcing bindings only for
  mutations.

## Referenced by

[[rpc-auth]] · [[acp-rpc-artifact-handlers]] ·
[[acp-rpc-checkpoint-handlers]] · [[acp-rpc-memory-event-handlers]] ·
[[rpc/_MOC]] · [[Transport]] · [[src/_MOC]]
