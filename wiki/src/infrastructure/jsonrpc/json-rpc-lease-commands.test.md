---
type: module
path: '@root/src/infrastructure/jsonrpc/json-rpc-lease-commands.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, infrastructure, json-rpc, lease]
aliases: [json-rpc-lease-commands.test]
---

# JSON-RPC Lease Command Tests

## Purpose

Pin [[json-rpc-lease-commands]] list, renew, and revoke projections onto the
workspace-scoped REST lease lifecycle.

## Interface

Vitest mapping suite over [[json-rpc]] `parseJsonRpcCommand`.

## Algorithm

Map `lease.list` to the workspace query with an encoded id. Map `lease.renew` to
the encoded renew path and preserve `ttl_seconds` in the body. Map
`lease.revoke` to its dedicated terminal-state route.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT leave workspace or lease identifiers unencoded.
- ❌ Do NOT drop an explicit renewal TTL.
- ❌ Do NOT alias revocation to release.

## Grill Log

- **Q:** Why distinguish revoke from release? **A:** They are different
  lifecycle decisions with different authority and audit meaning. _Rejected:_ a
  shared terminal lease command.

## Referenced by

[[json-rpc-lease-commands]] · [[jsonrpc/_MOC]] · [[Transport]] · [[src/_MOC]]
