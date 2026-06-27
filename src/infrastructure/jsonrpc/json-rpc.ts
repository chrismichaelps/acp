/** @Acp.Infra.JsonRpc — JSON-RPC 2.0 request normalization */
import { Data, Either, Option, Schema } from 'effect'
import {
  EventsStreamParams,
  InitializeSessionPayload,
  UpdateWorkStatePayload,
} from '../http/index.js'
import {
  ClaimWorkPayload,
  CreateArtifactPayload,
  CreateCheckpointPayload,
  CreateWorkPayload,
  LeaseId,
  RequestLeasePayload,
  RequestReviewPayload,
  WorkId,
} from '../../protocol/schema/index.js'

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

const JsonRpcEnvelope = Schema.Struct({
  jsonrpc: Schema.Literal('2.0'),
  method: Schema.String,
  id: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
  params: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
})

type JsonRpcEnvelope = typeof JsonRpcEnvelope.Type

export interface JsonRpcHttpRequest {
  readonly method: 'GET' | 'POST' | 'PATCH'
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

export type JsonRpcMethod =
  | 'session.initialize'
  | 'workspace.list'
  | 'work.create'
  | 'work.claim'
  | 'work.update'
  | 'lease.request'
  | 'lease.release'
  | 'artifact.create'
  | 'checkpoint.create'
  | 'review.request'
  | 'events.subscribe'

const methodLabels = new Set<string>([
  'session.initialize',
  'workspace.list',
  'work.create',
  'work.claim',
  'work.update',
  'lease.request',
  'lease.release',
  'artifact.create',
  'checkpoint.create',
  'review.request',
  'events.subscribe',
])

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

const invalidParams = (id: Option.Option<JsonRpcId>, data: unknown) =>
  new JsonRpcRequestError({
    code: -32602,
    message: 'Invalid params',
    id,
    expects_response: Option.isSome(id),
    data,
  })

const decodeParams = <A, I>(
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

// Validate params against the schema but forward the original wire JSON as the
// HTTP body. Decoding yields the Type side (Option-wrapped optionals), which is
// not serializable back onto the HTTP API; the raw validated params are.
const validatedBody = <A, I>(
  schema: Schema.Schema<A, I>,
  params: Option.Option<unknown>,
  id: Option.Option<JsonRpcId>,
): Either.Either<unknown, JsonRpcRequestError> =>
  Either.map(decodeParams(schema, params, id), () =>
    Option.getOrUndefined(params),
  )

const encodeSegment = (value: string): string => encodeURIComponent(value)

const methodNotFound = (method: string, id: Option.Option<JsonRpcId>) =>
  new JsonRpcRequestError({
    code: -32601,
    message: 'Method not found',
    id,
    expects_response: Option.isSome(id),
    data: { method },
  })

const toMethod = (
  method: string,
  id: Option.Option<JsonRpcId>,
): Either.Either<JsonRpcMethod, JsonRpcRequestError> =>
  methodLabels.has(method)
    ? Either.right(method as JsonRpcMethod)
    : Either.left(methodNotFound(method, id))

const commandFor = (
  envelope: JsonRpcEnvelope,
  id: Option.Option<JsonRpcId>,
): Either.Either<JsonRpcCommand, JsonRpcRequestError> =>
  Either.gen(function* () {
    const method = yield* toMethod(envelope.method, id)
    const expectsResponse = Option.isSome(id)

    if (method === 'session.initialize') {
      const body = yield* validatedBody(
        InitializeSessionPayload,
        envelope.params,
        id,
      )
      return {
        id,
        expects_response: expectsResponse,
        request: {
          method: 'POST',
          path: '/v1/session/initialize',
          body,
          label: method,
        },
      }
    }

    if (method === 'workspace.list') {
      return {
        id,
        expects_response: expectsResponse,
        request: { method: 'GET', path: '/v1/workspaces', label: method },
      }
    }

    if (method === 'work.create') {
      const body = yield* validatedBody(CreateWorkPayload, envelope.params, id)
      return {
        id,
        expects_response: expectsResponse,
        request: { method: 'POST', path: '/v1/work', body, label: method },
      }
    }

    if (method === 'work.claim') {
      const params = yield* decodeParams(
        Schema.Struct({
          work_id: WorkId,
          worker_id: ClaimWorkPayload.fields.worker_id,
        }),
        envelope.params,
        id,
      )
      return {
        id,
        expects_response: expectsResponse,
        request: {
          method: 'POST',
          path: `/v1/work/${encodeSegment(params.work_id)}/claim`,
          body: { worker_id: params.worker_id },
          label: method,
        },
      }
    }

    if (method === 'work.update') {
      const params = yield* decodeParams(
        Schema.Struct({
          work_id: WorkId,
          state: UpdateWorkStatePayload.fields.state,
        }),
        envelope.params,
        id,
      )
      return {
        id,
        expects_response: expectsResponse,
        request: {
          method: 'PATCH',
          path: `/v1/work/${encodeSegment(params.work_id)}`,
          body: { state: params.state },
          label: method,
        },
      }
    }

    if (method === 'lease.request') {
      const body = yield* validatedBody(
        RequestLeasePayload,
        envelope.params,
        id,
      )
      return {
        id,
        expects_response: expectsResponse,
        request: { method: 'POST', path: '/v1/leases', body, label: method },
      }
    }

    if (method === 'lease.release') {
      const params = yield* decodeParams(
        Schema.Struct({ lease_id: LeaseId }),
        envelope.params,
        id,
      )
      return {
        id,
        expects_response: expectsResponse,
        request: {
          method: 'POST',
          path: `/v1/leases/${encodeSegment(params.lease_id)}/release`,
          label: method,
        },
      }
    }

    if (method === 'artifact.create') {
      const body = yield* validatedBody(
        CreateArtifactPayload,
        envelope.params,
        id,
      )
      return {
        id,
        expects_response: expectsResponse,
        request: { method: 'POST', path: '/v1/artifacts', body, label: method },
      }
    }

    if (method === 'checkpoint.create') {
      const body = yield* validatedBody(
        CreateCheckpointPayload,
        envelope.params,
        id,
      )
      return {
        id,
        expects_response: expectsResponse,
        request: {
          method: 'POST',
          path: '/v1/checkpoints',
          body,
          label: method,
        },
      }
    }

    if (method === 'review.request') {
      const body = yield* validatedBody(
        RequestReviewPayload,
        envelope.params,
        id,
      )
      return {
        id,
        expects_response: expectsResponse,
        request: { method: 'POST', path: '/v1/reviews', body, label: method },
      }
    }

    const params = yield* decodeParams(EventsStreamParams, envelope.params, id)
    return {
      id,
      expects_response: expectsResponse,
      request: {
        method: 'GET',
        path: `/v1/events/stream?workspace_id=${encodeURIComponent(params.workspace_id)}`,
        stream: true,
        label: method,
      },
    }
  })

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
    return yield* commandFor(decoded.right, id)
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
