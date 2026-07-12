---
type: module
path: '@root/src/infrastructure/jsonrpc/json-rpc-memory-commands.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.66
depth_status: MEDIUM
tags: [module, seam, json-rpc, memory]
aliases: [json-rpc-memory-commands]
---

# JSON-RPC Memory Commands

## Purpose

Own workspace [[Memory]] JSON-RPC method mappings so [[json-rpc-command-map]]
stays under the file-size gate while `memory.create`/`memory.list` live in one
transport projection module.

## Interface

```typescript
export const memoryMethodLabels: readonly string[]
export const commandForMemory: (
  method: JsonRpcMethod,
  paramsValue: Option<unknown>,
  id: Option<JsonRpcId>,
  expectsResponse: boolean,
) => Option<Either<JsonRpcCommand, JsonRpcRequestError>>
```

### Methods

- `memory.create`
- `memory.list`

## Algorithm

`memory.create` validates params through [[memory.schema]] `CreateMemoryPayload`
(via `validatedBody`, forwarding the raw wire body) and maps to `POST /v1/memory`.
`memory.list` decodes a workspace-scoped query (`workspace_id` required;
`after_seq`, `limit`, `work_id`, `kind`, `key`, `label` optional) and renders only
the provided filters into a URL-encoded `GET /v1/memory?…` query string — the GET
route re-decodes that through `MemoryListParams` (`NumberFromString`). Omitting
`after_seq` lets the route apply its default `0`.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT duplicate [[memory-service]] creation/read rules here.
- ❌ Do NOT execute HTTP or domain services here.
- ❌ Do NOT emit empty query parameters — render only provided filters.

## Depth

MEDIUM (0.66). A mapping table, but it keeps Memory's JSON-RPC projection coherent
and preserves [[json-rpc-command-map]] capacity.

## Referenced by

[[json-rpc-command-map]] · [[json-rpc-memory-commands.test]] · [[memory-routes]]
· [[jsonrpc/_MOC]]
