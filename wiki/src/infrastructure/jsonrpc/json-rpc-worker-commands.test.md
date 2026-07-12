---
type: module
path: '@root/src/infrastructure/jsonrpc/json-rpc-worker-commands.test.ts'
fidelity: Active
domain: '[[Worker]]'
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, infrastructure, json-rpc, worker]
aliases: [json-rpc-worker-commands.test]
---

# JSON-RPC Worker Command Tests

## Purpose

Pin [[json-rpc-worker-commands]] host-scoped worker collection and item reads.

## Interface

Vitest mapping suite over [[json-rpc]] `parseJsonRpcCommand`.

## Algorithm

Map `worker.list` to `GET /v1/workers` with no workspace query. Map `worker.get`
to the encoded worker item path while preserving its method label.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT add workspace scope to host presence reads.
- ❌ Do NOT leave a worker id unencoded in the URL path.
- ❌ Do NOT turn registry reads into presence events.

## Grill Log

- **Q:** Why is worker listing host-scoped? **A:** The registry models current
  host presence, not workspace event history. _Rejected:_ synthesizing workspace
  ownership for workers.

## Referenced by

[[json-rpc-worker-commands]] · [[jsonrpc/_MOC]] · [[Worker]] · [[Transport]] ·
[[src/_MOC]]
