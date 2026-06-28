---
type: module
path: '@root/src/infrastructure/jsonrpc/json-rpc-resume-commands.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.7
depth_status: DEEP
tags: [module, seam, json-rpc]
aliases: [json-rpc-resume-commands]
---

# JSON-RPC Resume Commands

## Purpose

Own the work-resume JSON-RPC method mappings that would otherwise bloat
[[json-rpc-command-map]]. The methods are read-only projections over the new
work-scoped REST resume endpoints.

## Interface

```typescript
export const resumeMethodLabels: readonly string[]
export const commandForResume: (
  method: JsonRpcMethod,
  paramsValue: Option<unknown>,
  id: Option<JsonRpcId>,
  expectsResponse: boolean,
) => Option<Either<JsonRpcCommand, JsonRpcRequestError>>
```

### Methods

- `work.get`
- `checkpoint.list_for_work`
- `checkpoint.latest_for_work`
- `artifact.list_for_work`

## Algorithm

For supported resume methods, decode `work_id` through [[ids]], encode it as a URL
path segment, and return the canonical REST read command. Unsupported methods
return `Option.none` so [[json-rpc-command-map]] can continue with the mutation
table or method-not-found flow.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT execute HTTP or domain services here.
- ❌ Do NOT duplicate non-resume JSON-RPC method routing.
- ❌ Do NOT hand-build unencoded path identifiers.

## Depth

DEEP (0.7). Keeps the core command map stable while making future read/query
groups additive modules.

## Referenced by

[[json-rpc-command-map]] · [[jsonrpc/_MOC]]
