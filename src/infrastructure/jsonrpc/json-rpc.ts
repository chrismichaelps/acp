/** @Acp.Infra.JsonRpc — JSON-RPC 2.0 request normalization */
import { Either, Option, Schema } from 'effect'
import {
  commandFor,
  JsonRpcId,
  JsonRpcRequestError,
} from './json-rpc-command-map.js'
import type {
  JsonRpcCommand,
  JsonRpcErrorResponse,
  JsonRpcSuccessResponse,
} from './json-rpc-command-map.js'

export {
  JsonRpcErrorCode,
  JsonRpcId,
  JsonRpcRequestError,
} from './json-rpc-command-map.js'
export type {
  JsonRpcCommand,
  JsonRpcErrorObject,
  JsonRpcErrorResponse,
  JsonRpcHttpRequest,
  JsonRpcMethod,
  JsonRpcResponse,
  JsonRpcSuccessResponse,
} from './json-rpc-command-map.js'

const JsonRpcEnvelope = Schema.Struct({
  jsonrpc: Schema.Literal('2.0'),
  method: Schema.String,
  id: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
  params: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
})

type JsonRpcEnvelope = typeof JsonRpcEnvelope.Type

const toRpcId = (value: unknown): Either.Either<JsonRpcId, string> => {
  const decoded = Schema.decodeUnknownEither(JsonRpcId)(value)
  return Either.isRight(decoded)
    ? Either.right(decoded.right)
    : Either.left('id must be a string, number, or null')
}

const idFromEnvelope = (
  envelope: JsonRpcEnvelope,
): Either.Either<Option.Option<JsonRpcId>, JsonRpcRequestError> => {
  if (Option.isNone(envelope.id)) {
    return Either.right(Option.none())
  }
  const decoded = toRpcId(envelope.id.value)
  return Either.isRight(decoded)
    ? Either.right(Option.some(decoded.right))
    : Either.left(
        new JsonRpcRequestError({
          code: -32600,
          message: 'Invalid Request',
          id: Option.none(),
          expects_response: true,
          data: decoded.left,
        }),
      )
}

export const parseJsonRpcCommand = (
  value: unknown,
): Either.Either<JsonRpcCommand, JsonRpcRequestError> => {
  const decoded = Schema.decodeUnknownEither(JsonRpcEnvelope)(value)
  if (Either.isLeft(decoded)) {
    return Either.left(
      new JsonRpcRequestError({
        code: -32600,
        message: 'Invalid Request',
        id: Option.none(),
        expects_response: true,
        data: String(decoded.left),
      }),
    )
  }
  return Either.gen(function* () {
    const id = yield* idFromEnvelope(decoded.right)
    return yield* commandFor(decoded.right.method, decoded.right.params, id)
  })
}

const responseId = (id: Option.Option<JsonRpcId>): JsonRpcId | null =>
  Option.match(id, { onNone: () => null, onSome: (value) => value })

export const jsonRpcSuccess = (
  command: JsonRpcCommand,
  result: unknown,
): Option.Option<JsonRpcSuccessResponse> =>
  Option.match(command.id, {
    onNone: () => Option.none(),
    onSome: (id) => Option.some({ jsonrpc: '2.0', id, result }),
  })

export const jsonRpcError = (
  error: JsonRpcRequestError,
): Option.Option<JsonRpcErrorResponse> =>
  error.expects_response
    ? Option.some({
        jsonrpc: '2.0',
        id: responseId(error.id),
        error: {
          code: error.code,
          message: error.message,
          ...(error.data === undefined ? {} : { data: error.data }),
        },
      })
    : Option.none()
