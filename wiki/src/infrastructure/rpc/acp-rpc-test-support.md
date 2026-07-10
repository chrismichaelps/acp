---
type: module
path: '@root/src/infrastructure/rpc/acp-rpc-test-support.ts'
fidelity: Active
domain: '[[Worker]]'
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.61
depth_status: MEDIUM
tags: [module, medium, test-support]
aliases: [acp-rpc-test-support, rpc-test-support]
---

# Native RPC Test Support

## Purpose

Provide one composed native-RPC handler runtime plus canonical session payload,
bearer headers, schema decoding, and RPC options for contract/authorization tests.

## Interface

Exports `Runtime`, `decodeInitialize`, `bearer`, generic `decodePayload`, and
`rpcOptions`.

## Algorithm

Compose RPC session/worker/workspace handlers over [[app-live]] + [[id-clock]].
Build a canonical agent initialization payload with optional workspace ids; form
Bearer headers; decode arbitrary payload schemas; and construct the version-pinned
RPC options shape expected by `@effect/rpc` 0.75.1.

## Negative Logic

- ❌ Do NOT create a second application graph per helper call.
- ❌ Do NOT bypass schema decoding with unchecked payload casts.
- ❌ Do NOT use this test runtime as production composition.

## Depth

MEDIUM (0.61). Shared composition and payload helpers remove repeated Effect Layer
and protocol ceremony from native RPC tests.

## Grill Log

- **Q:** Why keep the final RPC options cast? **A:** Runtime middleware expects the
  options object while 0.75.1's declaration narrows the position to `Headers`; the
  isolated cast documents that SDK mismatch. _Rejected:_ duplicate casts in every
  test.

## Referenced by

[[rpc/_MOC]] · native RPC contract/scope tests
