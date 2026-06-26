/** @Acp.Infra.Http.ErrorMapper — tagged errors to JSON HTTP responses */
import { HttpServerResponse } from '@effect/platform'
import { toProtocolError } from '../../protocol/errors/protocol-error.js'
import type { DomainError } from '../../protocol/errors/protocol-error.js'

export const toHttpErrorResponse = (
  error: DomainError,
): HttpServerResponse.HttpServerResponse => {
  const mapped = toProtocolError(error)
  return HttpServerResponse.unsafeJson(mapped.body, {
    status: mapped.httpStatus,
    contentType: 'application/json',
  })
}
