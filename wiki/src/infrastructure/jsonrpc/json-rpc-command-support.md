---
type: module
path: '@root/src/infrastructure/jsonrpc/json-rpc-command-support.ts'
fidelity: Active
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.7
depth_status: DEEP
tags: [module, seam, json-rpc]
aliases: [json-rpc-command-support]
---

# JSON-RPC Command Support

## Purpose

Own the generic support types and helpers used by [[json-rpc-command-map]]:
JSON-RPC ids, reserved error codes, response shapes, command request shapes,
param decoding, raw-body validation, path-segment encoding, and method-not-found
construction. This keeps the method table focused on ACP command routing while
leaving the low-level JSON-RPC mechanics in one reusable module.

## Interface

### Signatures

```typescript
export const JsonRpcId: Schema.Schema<string | number | null>
export const JsonRpcErrorCode: Schema.Schema<-32700 | -32600 | -32601 | -32602 | -32603>

export type JsonRpcMethod = 'session.initialize' | ...
export interface JsonRpcHttpRequest { readonly method; readonly path; readonly body?; readonly stream?; readonly label }
export interface JsonRpcCommand { readonly id; readonly expects_response; readonly request }
export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse

export class JsonRpcRequestError extends Data.TaggedError('JsonRpcRequestError')<...> {}
export const decodeParams: <A, I>(schema, params, id) => Either<A, JsonRpcRequestError>
export const validatedBody: <A, I>(schema, params, id) => Either<unknown, JsonRpcRequestError>
export const encodeSegment: (value: string) => string
export const methodNotFound: (method: string, id: Option<JsonRpcId>) => JsonRpcRequestError
```

### Linkage

- **Requires:** `effect` `Data`, `Either`, `Option`, `Schema`
- **Consumed by:** [[json-rpc-command-map]], [[json-rpc-runtime]]

## Algorithm

`JsonRpcMethod` includes both command mutations and work-scoped resume reads:
`work.get`, `checkpoint.list_for_work`, `checkpoint.latest_for_work`, and
`artifact.list_for_work`.

`decodeParams` rejects missing params as JSON-RPC `-32602`, decodes present params
through the supplied Effect Schema, and returns either the typed value or a
`JsonRpcRequestError` carrying the parse detail. `validatedBody` uses the same
decode step but returns the original wire JSON so HTTP payloads never receive the
decoded Type side with `Option` wrappers. `encodeSegment` is the only way the
method table builds path segments. `methodNotFound` standardizes JSON-RPC
`-32601` failures for labels outside the closed method set.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT add ACP method routing here; [[json-rpc-command-map]] owns the table.
- ❌ Do NOT execute HTTP or domain services here.
- ❌ Do NOT reserialize decoded `Option` values back into HTTP bodies.

## Depth

DEEP (0.70). The interface is compact but hides every repeated JSON-RPC decoding
and error-shaping rule that would otherwise bloat each method group.

## Referenced by

[[json-rpc-command-map]] · [[jsonrpc/_MOC]]
