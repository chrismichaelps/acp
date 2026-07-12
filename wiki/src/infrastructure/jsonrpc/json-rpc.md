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
facade owns outer envelope parsing, request id semantics, and success/error
response helpers. The larger method-to-HTTP route table lives in
[[json-rpc-command-map]] so this public entry point stays under the spec §16.9
file-size limit.

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
  | 'artifact.delete'
  | 'checkpoint.create'
  | 'review.request'
  | 'review.approve'
  | 'review.reject'
  | 'review.request_changes'
  | 'events.subscribe'

export interface JsonRpcHttpRequest {
  readonly method: 'DELETE' | 'GET' | 'POST' | 'PATCH'
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

- **Requires:** [[json-rpc-command-map]]
- **Consumed by:** [[json-rpc-runtime]] (executes the normalized commands), and
  through it future stdio/WebSocket/`POST /rpc` host adapters.

## Algorithm

Decode the outer envelope as JSON-RPC 2.0, preserve the distinction between an
omitted notification id and an explicit `null` id, then delegate method
validation and params normalization to [[json-rpc-command-map]].

Response helpers are intentionally small. A command with no id is a JSON-RPC
notification and produces no success response; method and params failures from
notifications also produce no error response. Parse failures that cannot be
classified as notifications still produce standard JSON-RPC error objects with a
`null` response id. Domain error translation remains owned by the runtime adapter
that executes the command.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT duplicate router or domain service behavior in this module.
- ❌ Do NOT put method mapping logic back in this facade; use
  [[json-rpc-command-map]].
- ❌ Do NOT treat omitted `id` and explicit `id: null` as the same request shape.
- ❌ Do NOT map domain errors here; runtime adapters map execution failures.

## Depth

MEDIUM (0.7). The module is still an adapter core rather than a live host, but
after the command-map split it has a tighter interface: parse envelope, preserve
id semantics, delegate command mapping, and fold responses.

## Referenced by

[[jsonrpc-index]] · [[json-rpc-command-map]] · [[json-rpc.test]] · [[Transport]]
· [[src/_MOC]]
