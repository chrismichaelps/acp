---
type: module
path: '@root/src/infrastructure/rpc/acp-rpc-client.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, infrastructure, rpc, client]
aliases: [acp-rpc-client.test]
---

# ACP RPC Client Tests

## Purpose

Pin [[acp-rpc-client]] mounted URL normalization and scoped bearer ergonomics for
the generated native client.

## Interface

Vitest suite over pure client helpers and an in-process `RpcTest` client.

## Algorithm

Require the canonical `/rpc/native` path, normalize host URLs with or without a
trailing slash, and construct the host layer. Initialize a session through the
generated client, scope workspace creation with `withAcpRpcBearer`, and require
the low-level helper to emit the exact authorization header.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT duplicate or double-slash the mounted route.
- ❌ Do NOT require callers to hand-build bearer header objects per operation.
- ❌ Do NOT bypass the generated client contract.

## Grill Log

- **Q:** Why test helpers through a real generated call? **A:** Header shape is
  useful only if `RpcClient.withHeaders` carries it through handler auth.
  _Rejected:_ pure string tests as the sole client proof.

## Referenced by

[[acp-rpc-client]] · [[acp-rpc-contract]] · [[rpc/_MOC]] · [[Transport]] ·
[[src/_MOC]]
