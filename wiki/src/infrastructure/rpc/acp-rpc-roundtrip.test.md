---
type: test
path: '@root/src/infrastructure/rpc/acp-rpc-roundtrip.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.35
depth_status: SHALLOW
tags: [test, rpc, roundtrip]
aliases: [acp-rpc-roundtrip.test, acp-rpc-roundtrip-test]
---

# ACP RPC Roundtrip Test

## Purpose

Prove that the native `@effect/rpc` contract can be consumed through a generated
client rather than through direct handler calls or hand-built JSON-RPC envelopes.
This is the first contract smoke test for [[ADR-0007-effect-rpc-adoption]] and a
live middleware regression for retained workspace bindings.

## Behavior

The test builds a `RpcTest` client from [[acp-rpc-contract]], initializes a
scoped bearer session, creates a workspace, and verifies the typed response. It
uses [[acp-rpc-server]]'s dependency-complete handler layer because there is no
host process or shared HTTP composition in this transport-less path. A second
session is bound to one workspace and carries `work:create`; a generated-client
call targeting a foreign workspace must fail `forbidden` after middleware has
provided its actor context.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT replace this with a direct `accessHandler` call; the point is to
  exercise generated-client encoding and decoding.
- ❌ Do NOT hand-build native RPC payloads as JSON. Schema decoding belongs at
  the contract boundary.
- ❌ Do NOT test workspace isolation only through direct handlers; the regression
  must execute middleware plus `rpcWorkspaceActor` through the generated client.

## Referenced by

[[acp-rpc-client]] · [[acp-rpc-server]] · [[rpc/_MOC]]
