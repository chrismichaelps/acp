/** @Acp.Infra.JsonRpc.CommandSupport — shared JSON-RPC command mechanics */
import { Data, Either, Option, Schema } from 'effect'

export const JsonRpcId = Schema.Union(
  Schema.String,
  Schema.Number,
  Schema.Literal(null),
)
export type JsonRpcId = typeof JsonRpcId.Type

export const JsonRpcErrorCode = Schema.Literal(
  -32700,
  -32600,
  -32601,
  -32602,
  -32603,
)
export type JsonRpcErrorCode = typeof JsonRpcErrorCode.Type

export type JsonRpcMethod =
  | 'session.initialize'
  | 'workspace.list'
  | 'workspace.create'
  | 'workspace.update'
  | 'workspace.archive'
  | 'work.get'
  | 'work.create'
  | 'work.claim'
  | 'work.update'
  | 'work.publish_event'
  | 'lease.request'
  | 'lease.release'
  | 'artifact.create'
  | 'artifact.list_for_work'
  | 'artifact.read_content'
  | 'artifact.update'
  | 'artifact.delete'
  | 'checkpoint.create'
  | 'checkpoint.list_for_work'
  | 'checkpoint.latest_for_work'
  | 'review.list_for_work'
  | 'review.request'
  | 'review.approve'
  | 'review.reject'
  | 'review.request_changes'
  | 'events.subscribe'

export interface JsonRpcHttpRequest {
  readonly method: 'DELETE' | 'GET' | 'POST' | 'PATCH'
  readonly path: string
  readonly body?: unknown
  readonly stream?: boolean
  readonly label: JsonRpcMethod
}

export interface JsonRpcCommand {
  readonly id: Option.Option<JsonRpcId>
  readonly expects_response: boolean
  readonly request: JsonRpcHttpRequest
}

export interface JsonRpcErrorObject {
  readonly code: JsonRpcErrorCode
  readonly message: string
  readonly data?: unknown
}

export interface JsonRpcSuccessResponse {
  readonly jsonrpc: '2.0'
  readonly id: JsonRpcId
  readonly result: unknown
}

export interface JsonRpcErrorResponse {
  readonly jsonrpc: '2.0'
  readonly id: JsonRpcId | null
  readonly error: JsonRpcErrorObject
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse

export class JsonRpcRequestError extends Data.TaggedError(
  'JsonRpcRequestError',
)<{
  readonly code: JsonRpcErrorCode
  readonly message: string
  readonly id: Option.Option<JsonRpcId>
  readonly expects_response: boolean
  readonly data?: unknown
}> {}

const invalidParams = (id: Option.Option<JsonRpcId>, data: unknown) =>
  new JsonRpcRequestError({
    code: -32602,
    message: 'Invalid params',
    id,
    expects_response: Option.isSome(id),
    data,
  })

export const decodeParams = <A, I>(
  schema: Schema.Schema<A, I>,
  params: Option.Option<unknown>,
  id: Option.Option<JsonRpcId>,
): Either.Either<A, JsonRpcRequestError> => {
  if (Option.isNone(params)) {
    return Either.left(invalidParams(id, 'params are required'))
  }
  const decoded = Schema.decodeUnknownEither(schema)(params.value)
  return Either.isRight(decoded)
    ? Either.right(decoded.right)
    : Either.left(invalidParams(id, String(decoded.left)))
}

export const validatedBody = <A, I>(
  schema: Schema.Schema<A, I>,
  params: Option.Option<unknown>,
  id: Option.Option<JsonRpcId>,
): Either.Either<unknown, JsonRpcRequestError> =>
  Either.map(decodeParams(schema, params, id), () =>
    Option.getOrUndefined(params),
  )

export const encodeSegment = (value: string): string =>
  encodeURIComponent(value)

export const methodNotFound = (method: string, id: Option.Option<JsonRpcId>) =>
  new JsonRpcRequestError({
    code: -32601,
    message: 'Method not found',
    id,
    expects_response: Option.isSome(id),
    data: { method },
  })
