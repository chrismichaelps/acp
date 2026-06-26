/** @Acp.Protocol.Errors — tagged domain errors + protocol mapping */
import { Data, Option } from 'effect'
import type { ProtocolError, ErrorCode } from '../schema/error.schema.js'

export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly issues: readonly string[]
}> {}

export class NotFoundError extends Data.TaggedError('NotFoundError')<{
  readonly entity: string
  readonly id: string
}> {}

export class LeaseConflictError extends Data.TaggedError('LeaseConflictError')<{
  readonly resourceUri: string
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

export class UnsupportedCapabilityError extends Data.TaggedError(
  'UnsupportedCapabilityError',
)<{
  readonly capability: string
}> {}

export class StorageError extends Data.TaggedError('StorageError')<{
  readonly op: string
  readonly cause: string
}> {}

export type DomainError =
  | ValidationError
  | NotFoundError
  | LeaseConflictError
  | InvalidStateTransitionError
  | UnauthorizedError
  | UnsupportedCapabilityError
  | StorageError

export interface ProtocolErrorResponse {
  readonly httpStatus: number
  readonly body: ProtocolError
}

const envelope = (
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): ProtocolError['error'] => ({
  code,
  message,
  details: details === undefined ? Option.none() : Option.some(details),
})

/**
 * Total mapping from a tagged domain error to its wire protocol error.
 * Exhaustiveness is enforced by the `never` assertion in the default branch.
 * StorageError collapses to `internal_error` — internal causes never leak.
 */
export const toProtocolError = (e: DomainError): ProtocolErrorResponse => {
  switch (e._tag) {
    case 'ValidationError':
      return {
        httpStatus: 400,
        body: {
          error: envelope('invalid_request', 'Request failed validation.', {
            issues: e.issues,
          }),
        },
      }
    case 'UnauthorizedError':
      return {
        httpStatus: 401,
        body: { error: envelope('unauthorized', e.reason) },
      }
    case 'NotFoundError':
      return {
        httpStatus: 404,
        body: {
          error: envelope('not_found', `${e.entity} ${e.id} not found.`, {
            entity: e.entity,
            id: e.id,
          }),
        },
      }
    case 'LeaseConflictError':
      return {
        httpStatus: 409,
        body: {
          error: envelope(
            'lease_conflict',
            'Resource is already leased by another worker.',
            { resource: e.resourceUri, holder: e.holderWorkerId },
          ),
        },
      }
    case 'InvalidStateTransitionError':
      return {
        httpStatus: 409,
        body: {
          error: envelope(
            'invalid_state_transition',
            `Cannot transition from ${e.from} to ${e.to}.`,
            { from: e.from, to: e.to },
          ),
        },
      }
    case 'UnsupportedCapabilityError':
      return {
        httpStatus: 400,
        body: {
          error: envelope(
            'unsupported_capability',
            `Capability ${e.capability} is not supported.`,
            { capability: e.capability },
          ),
        },
      }
    case 'StorageError':
      return {
        httpStatus: 500,
        body: { error: envelope('internal_error', 'Internal error.') },
      }
    default: {
      const _exhaustive: never = e
      return _exhaustive
    }
  }
}
