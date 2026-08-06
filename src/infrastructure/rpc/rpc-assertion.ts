/** @Acp.Infra.Rpc.Assertion — provenance header over native RPC */
import { Effect, Either, Option } from 'effect'
import type { Headers } from '@effect/platform'
import {
  ACP_ASSERTION_HEADER,
  decodeAssertionHeader,
} from '../../domain/identity/index.js'
import type {
  ProtocolError,
  WorkerAssertionPayload,
} from '../../protocol/schema/index.js'
import { toRpcError } from './rpc-error.js'

/**
 * Reads the assertion header off an RPC request.
 *
 * The same header the HTTP routes use, so provenance travels one way across
 * every transport rather than one way per protocol. A malformed header fails
 * the call instead of decoding to "absent" — see
 * [[ADR-0024-worker-identity-provenance]].
 */
export const rpcAssertion = (
  headers: Headers.Headers,
): Effect.Effect<WorkerAssertionPayload | undefined, ProtocolError> =>
  Either.match(
    decodeAssertionHeader(
      Option.fromNullable(headers[ACP_ASSERTION_HEADER] as string | undefined),
    ),
    {
      // A client sent something unreadable, so this is a request failure and
      // must surface as one rather than as a host defect.
      onLeft: (error) => Effect.fail(toRpcError(error)),
      onRight: (assertion) => Effect.succeed(Option.getOrUndefined(assertion)),
    },
  )
