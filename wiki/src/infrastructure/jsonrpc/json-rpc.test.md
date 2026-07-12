---
type: module
path: '@root/src/infrastructure/jsonrpc/json-rpc.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
tags: [module, test, infrastructure, json-rpc, contract]
aliases: [json-rpc.test]
---

# JSON-RPC Transport Core Tests

## Purpose

Pin [[json-rpc]] envelope semantics and the broad ACP method-to-HTTP projection
that complements the focused command suites.

## Interface

Vitest pure mapping suite over `parseJsonRpcCommand`, `jsonRpcSuccess`, and
`jsonRpcError`.

## Algorithm

Map initialization in canonical and capability-negotiation shapes; workspace
list/create/update/archive; work create/claim/progress; artifact update/delete;
event subscribe/replay; and review actions. Require schema-derived wire bodies
and encoded resource paths. Return `-32601` for unknown methods, `-32602` for
missing params, and `-32600` for non-2.0 envelopes. Suppress success and error
responses for omitted-id notifications while preserving explicit `id: null` as
response-bearing.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT leak Effect `Option` values into HTTP wire bodies.
- ❌ Do NOT treat omitted id and explicit null id as equivalent.
- ❌ Do NOT reply to invalid notifications.
- ❌ Do NOT accept non-2.0 envelopes or unknown method labels.
- ❌ Do NOT interpolate unencoded ids into canonical paths.

## Grill Log

- **Q:** Why keep a broad suite beside focused command suites? **A:** It pins the
  facade's envelope/id/error laws and cross-domain method inventory, while focused
  suites let growing areas remain reviewable under the file-size gate.
  _Rejected:_ one monolithic suite or isolated mappings without facade coverage.

## Referenced by

[[json-rpc]] · [[json-rpc-command-map]] · [[jsonrpc/_MOC]] · [[Transport]] ·
[[src/_MOC]]
