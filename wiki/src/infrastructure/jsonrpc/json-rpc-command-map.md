---
type: module
path: '@root/src/infrastructure/jsonrpc/json-rpc-command-map.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.72
depth_status: DEEP
tags: [module, seam, json-rpc]
aliases: [json-rpc-command-map]
---

# JSON-RPC Command Map

## Purpose

Own the closed mapping from JSON-RPC method labels to canonical ACP HTTP
commands. This module validates each method's params with the same Effect Schema
payloads used by [[acp-http-api]], splits path identifiers from operation bodies,
URL-encodes path segments through [[json-rpc-command-support]], and returns a
transport-neutral `JsonRpcCommand`.

The split keeps [[json-rpc]] focused on envelope parsing, [[json-rpc-command-support]]
focused on reusable JSON-RPC mechanics, and this module focused on the larger ACP
method table. It exists to satisfy the spec's file-size rule without weakening
method compatibility tests.

## Interface

### Signatures

```typescript
export const JsonRpcId: Schema.Schema<string | number | null>
export const JsonRpcErrorCode: Schema.Schema<-32700 | -32600 | -32601 | -32602 | -32603>

export type JsonRpcMethod = 'session.initialize' | ...

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

export class JsonRpcRequestError extends Data.TaggedError('JsonRpcRequestError')<...> {}

export const commandFor: (
  methodLabel: string,
  paramsValue: Option.Option<unknown>,
  id: Option.Option<JsonRpcId>,
) => Either<JsonRpcCommand, JsonRpcRequestError>
```

### Linkage

- **Requires:** [[json-rpc-command-support]], [[acp-http-api]],
  [[work-unit.schema]], [[lease.schema]], [[artifact.schema]],
  [[checkpoint.schema]], [[review.schema]]
- **Consumed by:** [[json-rpc]] facade.

## Algorithm

Validate the method label against the closed method set. Full-body methods
(`session.initialize`, `workspace.create`, `work.create`, `lease.request`,
`artifact.create`, `checkpoint.create`, `review.request`) validate params with
the HTTP payload schema and forward the original JSON body so `Option`-wrapped
decoded values do not leak back onto the wire. Path-bearing methods such as
`workspace.update`, `workspace.archive`, `work.claim`, and `lease.release` decode
resource identifiers and operation fields, encode path segments with
`encodeURIComponent`, and build the exact REST route used by the HTTP transport.
`events.subscribe` builds the SSE route and marks the command as stream-capable.

Unknown method labels fail as JSON-RPC `-32601`. Missing or invalid params fail
as `-32602`, with response suppression for notifications handled later by
[[json-rpc]].

## Negative Logic (Prohibited Paths)

- ❌ Do NOT parse outer JSON-RPC envelopes here; [[json-rpc]] owns envelope shape.
- ❌ Do NOT execute domain services or dispatch HTTP requests here.
- ❌ Do NOT add a method label without matching HTTP/schema coverage and tests.
- ❌ Do NOT hand-build unencoded resource paths.

## Depth

DEEP (0.72). The module hides the large cross-transport method table and path/body
normalization rules behind one pure function. Deleting it would push mapping
knowledge back into the parser facade or runtime dispatch.

## Referenced by

[[json-rpc]] · [[jsonrpc/_MOC]] · [[Transport]]
