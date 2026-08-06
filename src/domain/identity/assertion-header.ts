/** @Acp.Domain.Identity.Header — provenance as request metadata */
import { Either, Option, Schema } from 'effect'
import { ValidationError } from '../../protocol/errors/protocol-error.js'
import { WorkerAssertionPayload } from '../../protocol/schema/index.js'

/**
 * Provenance travels as a header, beside the bearer token it accompanies.
 *
 * Three of the four signed actions — review reject, request-changes and cancel
 * — have no request body at all, so a body-carried assertion would mean adding
 * one to each. A header is also uniform across every current and future signed
 * action, and matches what the value is: metadata about the request rather
 * than part of what is being asked for.
 */
export const ACP_ASSERTION_HEADER = 'x-acp-assertion'

const invalid = (detail: string) =>
  new ValidationError({
    issues: [`${ACP_ASSERTION_HEADER} is not a valid assertion: ${detail}`],
  })

/**
 * Decodes a base64url JSON assertion header.
 *
 * Absence and malformation are deliberately different answers. An absent header
 * means no proof was offered, which is permitted unless signatures are
 * enforced. A present-but-unreadable header means proof was offered and is
 * broken — treating that as absence would let a corrupted or tampered header
 * silently downgrade to an unsigned request.
 */
export const decodeAssertionHeader = (
  raw: Option.Option<string>,
): Either.Either<Option.Option<WorkerAssertionPayload>, ValidationError> =>
  Option.match(raw, {
    onNone: () => Either.right(Option.none()),
    onSome: (encoded) => {
      if (encoded === '') return Either.left(invalid('header is empty'))
      let parsed: unknown
      try {
        parsed = JSON.parse(
          Buffer.from(encoded, 'base64url').toString('utf8'),
        ) as unknown
      } catch {
        return Either.left(invalid('not base64url-encoded JSON'))
      }
      return Either.match(
        Schema.decodeUnknownEither(WorkerAssertionPayload)(parsed),
        {
          onLeft: (error) => Either.left(invalid(String(error))),
          onRight: (assertion) => Either.right(Option.some(assertion)),
        },
      )
    },
  })
