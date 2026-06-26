/** @Acp.Protocol.Error — wire shape of a protocol error response */
import { Schema } from 'effect'

export const ErrorCode = Schema.Literal(
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
)
export type ErrorCode = typeof ErrorCode.Type

export const ProtocolError = Schema.Struct({
  error: Schema.Struct({
    code: ErrorCode,
    message: Schema.String,
    details: Schema.optionalWith(
      Schema.Record({ key: Schema.String, value: Schema.Unknown }),
      { as: 'Option', nullable: true },
    ),
  }),
})
export type ProtocolError = typeof ProtocolError.Type
