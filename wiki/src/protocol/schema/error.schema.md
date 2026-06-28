---
type: module
path: '@root/src/protocol/schema/error.schema.ts'
fidelity: Active
domain: '[[Event]]'
grammar: '[[grammar/typescript]]'
depth_score: 0.6
depth_status: MEDIUM
tags: [module, medium]
aliases: [error.schema]
---

# Protocol Error Schema (wire shape)

## Purpose

The wire shape of a protocol error response (spec §15) and the closed `ErrorCode`
vocabulary. This is what the transport edge encodes; the tagged domain errors that
map _to_ it live in [[protocol-error]].

## Interface

### Signatures

```typescript
export const ErrorCode: Schema.Literal<
  [
    'invalid_request',
    'unauthorized',
    'forbidden',
    'not_found',
    'conflict',
    'lease_conflict',
    'invalid_state_transition',
    'unsupported_capability',
    'rate_limited',
    'internal_error',
  ]
>
export const ProtocolError: Schema.Struct<{
  error: Schema.Struct<{
    code: ErrorCode
    message: string
    details: optionalWith<Record<string, Unknown>, Option>
  }>
}>
export type ProtocolError = typeof ProtocolError.Type
```

## Algorithm

A `{ error: { code, message, details? } }` envelope. `code` is the closed spec §15
vocabulary, each mapping to an HTTP status at the boundary (handled in
[[protocol-error]]).

## Negative Logic (Prohibited Paths)

- ❌ Do NOT emit an error `code` outside this union.
- ❌ Do NOT leak internal stack traces into `message`/`details`.

## Depth

MEDIUM (0.6).

## Referenced by

[[protocol-error]] · [[src/_MOC]]
