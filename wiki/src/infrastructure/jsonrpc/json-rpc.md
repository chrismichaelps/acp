---
type: module
path: '@root/src/infrastructure/jsonrpc/json-rpc.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.7
depth_status: MEDIUM
tags: [module, seam, json-rpc]
aliases: [json-rpc, json-rpc-transport-core]
---

# JSON-RPC Transport Core

## Purpose

Normalize JSON-RPC 2.0 envelopes into canonical ACP transport commands. This
module owns method-name compatibility for spec §13 and validates every params
object with the same Effect Schema payloads used by the HTTP API. It does not
execute domain services and does not open a stdio or WebSocket runtime; those
adapters consume the normalized command surface in a later slice.

## Interface

### Signatures

```typescript
export type JsonRpcMethod =
  | 'session.initialize'
  | 'workspace.list'
  | 'work.create'
  | 'work.claim'
  | 'work.update'
  | 'work.publish_event'
  | 'lease.request'
  | 'lease.release'
  | 'artifact.create'
  | 'checkpoint.create'
  | 'review.request'
  | 'review.approve'
  | 'review.reject'
  | 'review.request_changes'
  | 'events.subscribe'

export interface JsonRpcHttpRequest {
  readonly method: 'GET' | 'POST' | 'PATCH'
  readonly path: string
  readonly body?: unknown
  readonly stream?: boolean
  readonly label: JsonRpcMethod
}

export interface JsonRpcCommand {
  readonly id: Option.Option<JsonRpcId>
  readonly expects_response: boolean
  readonly request: JsonRpcHttpRequest
}

export const parseJsonRpcCommand: (
  value: unknown,
) => Either<JsonRpcCommand, JsonRpcRequestError>
export const jsonRpcSuccess: (
  command: JsonRpcCommand,
  result: unknown,
) => Option<JsonRpcSuccessResponse>
export const jsonRpcError: (
  error: JsonRpcRequestError,
) => Option<JsonRpcErrorResponse>
```

### Linkage

- **Requires:** [[acp-http-api]], [[work-unit.schema]], [[lease.schema]],
  [[artifact.schema]], [[checkpoint.schema]], [[review.schema]]
- **Consumed by:** [[json-rpc-runtime]] (executes the normalized commands), and
  through it future stdio/WebSocket/`POST /rpc` host adapters.

## Algorithm

Decode the outer envelope as JSON-RPC 2.0, preserve the distinction between an
omitted notification id and an explicit `null` id, validate the method against
the closed spec §13 table, then decode params with the existing protocol schema
for that operation. Path-bearing methods split resource ids from request bodies:
`work.claim`, `work.update`, `work.publish_event`, `lease.release`,
`review.approve`, `review.reject`, and `review.request_changes` URL-encode the
path segment and leave only operation payload fields in the body.
`events.subscribe` maps to the SSE stream route and marks the command as
stream-capable.

Full-payload methods validate params with the schema but forward the **original
wire JSON** as the request body (`validatedBody`), not the decoded Type side: the
decoded form wraps optionals in `Option`, which is not serializable back onto the
HTTP API that [[json-rpc-runtime]] dispatches to.
This keeps `session.initialize` compatible with both the existing full-worker
payload and the draft §9 `protocol_version` + client capability object.

Response helpers are intentionally small. A command with no id is a JSON-RPC
notification and produces no success response; method and params failures from
notifications also produce no error response. Parse failures that cannot be
classified as notifications still produce standard JSON-RPC error objects with a
`null` response id. Domain error translation remains owned by the runtime adapter
that executes the command.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT duplicate router or domain service behavior in this module.
- ❌ Do NOT accept methods outside the spec §13 table without a spec update.
- ❌ Do NOT treat omitted `id` and explicit `id: null` as the same request shape.
- ❌ Do NOT map domain errors here; runtime adapters map execution failures.

## Depth

MEDIUM (0.7). The module is still an adapter core rather than a live host, but it
anchors cross-transport method compatibility and schema reuse before stdio or
WebSocket execution is introduced.

## Referenced by

[[jsonrpc-index]] · [[Transport]] · [[src/_MOC]]
