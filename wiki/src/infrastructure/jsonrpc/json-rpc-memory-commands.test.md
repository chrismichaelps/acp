---
type: module
path: '@root/src/infrastructure/jsonrpc/json-rpc-memory-commands.test.ts'
fidelity: Active
domain: '[[Memory]]'
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, infrastructure, json-rpc, memory]
aliases: [json-rpc-memory-commands.test]
---

# JSON-RPC Memory Command Tests

## Purpose

Prove [[json-rpc-memory-commands]] preserves memory creation bodies and renders
only supplied list filters while requiring workspace scope.

## Interface

Vitest mapping suite over [[json-rpc]] `parseJsonRpcCommand`.

## Algorithm

Map `memory.create` to `POST /v1/memory` with kind, key, summary, content, and
labels unchanged. Map a fully filtered `memory.list` to its ordered query. With
only `workspace_id`, omit `after_seq` so the route owns its default. Reject a
list request without `workspace_id`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT emit absent filters as empty query parameters.
- ❌ Do NOT synthesize `after_seq` in the transport projection.
- ❌ Do NOT allow a host-wide memory scan without workspace scope.

## Grill Log

- **Q:** Where should the default cursor live? **A:** In the canonical HTTP
  route schema; JSON-RPC omission must remain omission. _Rejected:_ duplicating
  route defaults in each transport.

## Referenced by

[[json-rpc-memory-commands]] · [[jsonrpc/_MOC]] · [[Memory]] · [[Transport]] ·
[[src/_MOC]]
