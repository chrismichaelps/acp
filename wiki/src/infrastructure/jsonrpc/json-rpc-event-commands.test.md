---
type: module
path: '@root/src/infrastructure/jsonrpc/json-rpc-event-commands.test.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.42
depth_status: MEDIUM
tags: [module, test, json-rpc]
aliases: [json-rpc-event-commands-test]
---

# JSON-RPC Event Commands Test

## Purpose

Focused regression coverage for [[json-rpc-event-commands]]. The central
[[json-rpc]] transport test file already covers broad method dispatch, so this
file owns event-specific mapping details that would otherwise push that file over
the repository file-size gate.

## Interface

```typescript
describe('JSON-RPC event command mapping', () => void)
```

The test calls [[json-rpc]] `parseJsonRpcCommand` with an `events.list` request
containing `workspace_id`, `after_seq`, and `limit`, then asserts the generated
canonical command targets `GET /v1/events` with `&limit=` preserved.

## Algorithm

Construct a minimal JSON-RPC request, require `Either.right`, and compare the
resulting `CliRequest`-like command shape exactly. The test intentionally lives
near the event command mapper because bounded replay is a transport projection
concern, not JSON-RPC runtime execution behavior.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT duplicate runtime execution tests here.
- ❌ Do NOT broaden this file into generic JSON-RPC coverage; keep the central
  suite below the file-size gate.

## Depth

MEDIUM (0.42). The file is a small regression pin, but it prevents event replay
query drift without expanding the broad transport test module.

## Referenced by

[[jsonrpc/_MOC]] · [[json-rpc-event-commands]]
