---
type: module
path: '@root/src/infrastructure/jsonrpc/json-rpc-review-commands.test.ts'
fidelity: Active
domain: '[[Review]]'
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, infrastructure, json-rpc, review]
aliases: [json-rpc-review-commands.test]
---

# JSON-RPC Review Command Tests

## Purpose

Prove [[json-rpc-command-map]] preserves signed approval evidence and maps review
cancellation to its dedicated route.

## Interface

Vitest mapping suite over [[json-rpc]] `parseJsonRpcCommand`.

## Algorithm

Map `review.approve` with met requirements and the complete algorithm/key/value
signature object to the approval route. Map `review.cancel` to the cancellation
endpoint without fabricating an outcome body.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT strip or reshape approval signature evidence.
- ❌ Do NOT alias cancellation to rejection or requested changes.
- ❌ Do NOT add an invented cancellation payload.

## Grill Log

- **Q:** Why pin signature transport separately? **A:** Approval evidence is
  auditable provenance and must survive projection byte-for-structure.
  _Rejected:_ retaining only met requirements.

## Referenced by

[[json-rpc-command-map]] · [[json-rpc]] · [[jsonrpc/_MOC]] · [[Review]] ·
[[Transport]] · [[src/_MOC]]
