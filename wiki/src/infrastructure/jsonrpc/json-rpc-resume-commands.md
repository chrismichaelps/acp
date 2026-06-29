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

Own the resume JSON-RPC method mappings that would otherwise bloat
[[json-rpc-command-map]]. The methods are read-only projections over work- and
workspace-scoped REST resume endpoints.

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
- `work.list_for_workspace`
- `checkpoint.list_for_work`
- `checkpoint.list_for_workspace`
- `checkpoint.latest_for_work`
- `artifact.list_for_work`
- `artifact.list_for_workspace`
- `artifact.read_content`
- `review.list_for_work`
- `review.list_for_workspace`

## Algorithm

For work-scoped resume methods, decode `work_id` through [[ids]], encode it as a
URL path segment, and return the canonical REST read command. For workspace work
indexes, decode `workspace_id` and map it to
`GET /v1/workspaces/{workspace_id}/work`. Workspace aggregate methods reuse the
same decoded `workspace_id` and map to `/checkpoints`, `/artifacts`, or
`/reviews` under the workspace path. For artifact content reads, decode
`artifact_id` and map it to `GET /v1/artifacts/{artifact_id}/content`.
Unsupported methods return `Option.none` so [[json-rpc-command-map]] can
continue with the mutation table or method-not-found flow.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT execute HTTP or domain services here.
- ❌ Do NOT duplicate non-resume JSON-RPC method routing.
- ❌ Do NOT hand-build unencoded path identifiers.

## Depth

DEEP (0.7). Keeps the core command map stable while making future read/query
groups additive modules.

## Referenced by

[[json-rpc-command-map]] · [[jsonrpc/_MOC]]
