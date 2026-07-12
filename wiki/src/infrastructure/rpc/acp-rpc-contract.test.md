---
type: module
path: '@root/src/infrastructure/rpc/acp-rpc-contract.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, infrastructure, rpc, contract]
aliases: [acp-rpc-contract.test]
---

# ACP RPC Contract Tests

## Purpose

Prove [[acp-rpc-contract]] exposes the exact operation registry, constant/group
identity, scope metadata, auth attachment, and universal telemetry coverage.

## Interface

Vitest reflection suite over `AcpRpcGroup`, `AcpRpcs`, annotations, and
middleware sets.

## Algorithm

Compare the sorted complete operation tag list. Require representative constants
to be the objects stored in the group registry. Verify initialization is open,
secured methods carry their precise permission annotations, and auth middleware
is attached. Iterate every request and require telemetry middleware.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT add/remove/rename an operation without registry review.
- ❌ Do NOT secure session initialization or omit auth from scoped operations.
- ❌ Do NOT attach a broad substitute scope to a specific mutation.
- ❌ Do NOT ship an RPC operation without completion telemetry.

## Grill Log

- **Q:** Why assert middleware on every operation? **A:** Observability omissions
  are easiest to introduce on new tags; iteration makes the invariant closed.
  _Rejected:_ representative telemetry spot checks.

## Referenced by

[[acp-rpc-contract]] · [[rpc-auth-middleware]] ·
[[rpc-telemetry-middleware]] · [[rpc/_MOC]] · [[Transport]] · [[src/_MOC]]
