---
type: module
path: '@root/src/infrastructure/rpc/acp-rpc-review-scope.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, infrastructure, rpc, auth, review]
aliases: [acp-rpc-review-scope.test]
---

# ACP RPC Review Scope Tests

## Purpose

Prove [[rpc-resource-workspace-auth]] and direct workspace auth isolate every
native review operation by the parent WorkUnit's workspace.

## Interface

Vitest adversarial handler suite with an owning session and an action-permissioned
attacker bound to another workspace.

## Algorithm

The owner creates/runs work and requests review. Require the attacker to receive
`forbidden` for another request on that work, approve, reject, request changes,
cancel, list by work, and list by workspace.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT authorize review outcomes from permission alone.
- ❌ Do NOT skip binding checks for review reads.
- ❌ Do NOT derive tenancy from reviewer/requester identity.

## Grill Log

- **Q:** Why cover every outcome? **A:** Each has a distinct scope and handler;
  one correctly guarded path does not prove the others. _Rejected:_ a single
  representative review denial.

## Referenced by

[[rpc-resource-workspace-auth]] · [[acp-rpc-review-handlers]] · [[rpc-auth]] ·
[[rpc/_MOC]] · [[Transport]] · [[src/_MOC]]
