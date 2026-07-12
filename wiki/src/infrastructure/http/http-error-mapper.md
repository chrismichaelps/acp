---
type: module
path: '@root/src/infrastructure/http/http-error-mapper.ts'
fidelity: Active
domain: '[[Event]]'
grammar: '[[grammar/typescript]]'
seam: '[[Transport]]'
depth_score: 0.72
depth_status: DEEP
tags: [module, deep, seam]
aliases: [http-error-mapper, HttpErrorMapper]
---

# HTTP Error Mapper

## Purpose

Convert tagged domain errors into stable JSON `HttpServerResponse`s at the
[[Transport]] boundary. This module is the only place where HTTP status,
`application/json`, and [[ProtocolError]] envelope rendering are coupled.

## Interface

### Signatures

```typescript
export const toHttpErrorResponse: (error: DomainError) => HttpServerResponse
```

### Linkage

- **Requires:** [[protocol-error]], [[error.schema]]
- **Consumed by:** future HTTP handlers and server middleware.

## Algorithm

1. Call `toProtocolError(error)` for the total domain-error mapping.
2. Return `HttpServerResponse.unsafeJson(body, { status, contentType:
'application/json' })`.
3. Preserve the no-leak rule: `StorageError` becomes `internal_error` without its
   cause.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT expose `StorageError.cause` or low-level stack details.
- ❌ Do NOT throw; mapping is total over `DomainError`.
- ❌ Do NOT let handlers handcraft protocol error JSON.

## Depth

DEEP (0.72). One small adapter hides every HTTP status decision and protects the
wire no-leak invariant.

## Referenced by

[[http-index]] · [[http-error-mapper.test]] · [[Transport]] · [[src/_MOC]]
