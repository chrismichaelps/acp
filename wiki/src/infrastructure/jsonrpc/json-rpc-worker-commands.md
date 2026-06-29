---
type: module
path: '@root/src/infrastructure/jsonrpc/json-rpc-worker-commands.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.64
depth_status: MEDIUM
tags: [module, seam, json-rpc]
aliases: [json-rpc-worker-commands]
---

# JSON-RPC Worker Commands

## Purpose

Own the host-scoped worker read JSON-RPC mappings so [[json-rpc-command-map]]
does not grow past the file-size gate as read surfaces expand. The methods expose
current [[Worker]] registry state without publishing presence into workspace
events.

## Interface

```typescript
export const workerMethodLabels: readonly ['worker.list', 'worker.get']
export const commandForWorker: (
  method: JsonRpcMethod,
  paramsValue: Option<unknown>,
  id: Option<JsonRpcId>,
  expectsResponse: boolean,
) => Option<Either<JsonRpcCommand, JsonRpcRequestError>>
```

### Methods

- `worker.list`
- `worker.get`

## Algorithm

`worker.list` maps to `GET /v1/workers`. `worker.get` decodes `worker_id`
through [[ids]], URL-encodes the path segment, and maps to
`GET /v1/workers/{worker_id}`. Unsupported methods return `Option.none` so
[[json-rpc-command-map]] can continue through the rest of the command table.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT emit worker presence events.
- ❌ Do NOT attach a workspace id to worker reads.
- ❌ Do NOT execute HTTP or domain services here.

## Depth

MEDIUM (0.64). The module is a narrow mapping table, but it keeps host presence
reads isolated from workspace resume and mutation commands.

## Referenced by

[[json-rpc-command-map]] · [[jsonrpc/_MOC]]
