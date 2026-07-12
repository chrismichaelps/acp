---
type: module
path: '@root/src/protocol/errors/protocol-error.ts'
fidelity: Active
domain: '[[Event]]'
grammar: '[[grammar/typescript]]'
depth_score: 0.75
depth_status: DEEP
tags: [module, deep]
aliases: [protocol-error, tagged-errors]
---

# Tagged Domain Errors + Protocol Mapping

## Purpose

The Effect `Data.TaggedError` families for domain failures (spec §16.6) and the
pure function mapping each to a wire [[error.schema|ProtocolError]] (`code` +
HTTP status). Domain services fail with these; the transport edge calls `toProtocolError`.

## Interface

### Signatures

```typescript
export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly issues: ReadonlyArray<string>
}> {}
export class NotFoundError extends Data.TaggedError('NotFoundError')<{
  readonly entity: string
  readonly id: string
}> {}
export class LeaseConflictError extends Data.TaggedError('LeaseConflictError')<{
  readonly resourceUri: string
  readonly holderWorkerId: string
}> {}
export class ClaimConflictError extends Data.TaggedError('ClaimConflictError')<{
  readonly workId: string
  readonly holderWorkerId: string
}> {}
export class InvalidStateTransitionError extends Data.TaggedError(
  'InvalidStateTransitionError',
)<{
  readonly from: string
  readonly to: string
}> {}
export class UnauthorizedError extends Data.TaggedError('UnauthorizedError')<{
  readonly reason: string
}> {}
export class ForbiddenError extends Data.TaggedError('ForbiddenError')<{
  readonly reason: string
}> {}
export class UnsupportedCapabilityError extends Data.TaggedError(
  'UnsupportedCapabilityError',
)<{ readonly capability: string }> {}
export class StorageError extends Data.TaggedError('StorageError')<{
  readonly op: string
  readonly cause: string
}> {}

export type DomainError =
  | ValidationError
  | NotFoundError
  | ClaimConflictError
  | LeaseConflictError
  | InvalidStateTransitionError
  | UnauthorizedError
  | ForbiddenError
  | UnsupportedCapabilityError
  | StorageError

export const toProtocolError: (e: DomainError) => {
  httpStatus: number
  body: ProtocolError
}
```

## Algorithm

`toProtocolError` is a total `switch` on `e._tag`:

- `ValidationError → invalid_request / 400`
- `UnauthorizedError → unauthorized / 401` (no/invalid credentials)
- `ForbiddenError → forbidden / 403` (authenticated but lacking the required scope)
- `NotFoundError → not_found / 404`
- `ClaimConflictError → claim_conflict / 409`
- `LeaseConflictError → lease_conflict / 409`
- `InvalidStateTransitionError → invalid_state_transition / 409`
- `UnsupportedCapabilityError → unsupported_capability / 400`
- `StorageError → internal_error / 500`
  Exhaustiveness enforced by a `never` assertion in the default branch.

Spec §15 codes `conflict` and `rate_limited` remain reserved wire vocabulary in
[[error.schema]]: no domain error produces them yet (specific conflicts use
`claim_conflict`/`lease_conflict`; no rate limiter exists). They are kept in the
`ErrorCode` literal so clients accept them when a producer appears.

## Negative Logic (Prohibited Paths)

- ❌ Do NOT `throw` raw `Error` in domain code — construct a tagged error.
- ❌ Do NOT map `StorageError` details into the response body — collapse to `internal_error`.
- ❌ Do NOT let a non-`DomainError` defect reach `toProtocolError` — convert to `internal_error` first.

## Depth

DEEP (0.75). One total mapping hides all error-translation policy; deletion scatters
ad-hoc status codes across every transport handler.

## Referenced by

[[error.schema]] · [[protocol-error.test]] · [[errors/_MOC]] · [[Transport]] ·
[[src/_MOC]]
