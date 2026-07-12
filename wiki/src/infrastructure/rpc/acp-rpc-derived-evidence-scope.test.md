---
type: module
path: '@root/src/infrastructure/rpc/acp-rpc-derived-evidence-scope.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, infrastructure, rpc, auth, evidence]
aliases: [acp-rpc-derived-evidence-scope.test]
---

# ACP RPC Derived Evidence Scope Tests

## Purpose

Prove [[rpc-resource-workspace-auth]] denies artifact/checkpoint calls when their
stored parent resolves to a workspace outside the session binding.

## Interface

Vitest adversarial handler suite with owner and fully scoped cross-workspace
attacker sessions.

## Algorithm

The owner creates work, artifact, and checkpoint in the protected workspace.
The attacker holds read/update/delete permissions but is bound elsewhere.
Require artifact content/list/update/delete and checkpoint list/latest to return
typed `forbidden` after resource-to-workspace derivation.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT authorize by permission alone.
- ❌ Do NOT trust a caller-supplied workspace for by-id evidence operations.
- ❌ Do NOT disguise a valid cross-workspace identity as `not_found`.

## Grill Log

- **Q:** Why grant the attacker action scopes? **A:** It isolates tenant binding
  as the denying condition. _Rejected:_ a denial explainable by missing scope.

## Referenced by

[[rpc-resource-workspace-auth]] · [[acp-rpc-artifact-handlers]] ·
[[acp-rpc-checkpoint-handlers]] · [[rpc/_MOC]] · [[Transport]] · [[src/_MOC]]
