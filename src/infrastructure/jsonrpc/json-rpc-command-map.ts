/** @Acp.Infra.JsonRpc.CommandMap — JSON-RPC methods to ACP HTTP commands */
import { Data, Either, Option, Schema } from 'effect'
import {
  ApproveReviewPayload,
  EventsStreamParams,
  InitializeSessionPayload,
  PublishWorkEventPayload,
  UpdateWorkStatePayload,
} from '../http/index.js'
import {
  ArtifactId,
  ClaimWorkPayload,
  CreateArtifactPayload,
  CreateCheckpointPayload,
  CreateWorkPayload,
  LeaseId,
  RequestLeasePayload,
  RequestReviewPayload,
  ReviewId,
  WorkId,
  CreateWorkspacePayload,
  UpdateWorkspacePayload,
  WorkspaceId,
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

export type JsonRpcMethod =
  | 'session.initialize'
  | 'workspace.list'
  | 'workspace.create'
  | 'workspace.update'
  | 'workspace.archive'
  | 'work.create'
  | 'work.claim'
  | 'work.update'
  | 'work.publish_event'
  | 'lease.request'
  | 'lease.release'
  | 'artifact.create'
  | 'artifact.delete'
  | 'checkpoint.create'
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

const methodLabels = new Set<string>([
  'session.initialize',
  'workspace.list',
  'workspace.create',
  'workspace.update',
  'workspace.archive',
  'work.create',
  'work.claim',
  'work.update',
  'work.publish_event',
  'lease.request',
  'lease.release',
  'artifact.create',
  'artifact.delete',
  'checkpoint.create',
  'review.request',
  'review.approve',
  'review.reject',
  'review.request_changes',
  'events.subscribe',
])

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

export const commandFor = (
  methodLabel: string,
  paramsValue: Option.Option<unknown>,
  id: Option.Option<JsonRpcId>,
): Either.Either<JsonRpcCommand, JsonRpcRequestError> =>
  Either.gen(function* () {
    const method = yield* toMethod(methodLabel, id)
    const expectsResponse = Option.isSome(id)

    if (method === 'session.initialize') {
      const body = yield* validatedBody(
        InitializeSessionPayload,
        paramsValue,
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

    if (method === 'workspace.create') {
      const body = yield* validatedBody(CreateWorkspacePayload, paramsValue, id)
      return {
        id,
        expects_response: expectsResponse,
        request: {
          method: 'POST',
          path: '/v1/workspaces',
          body,
          label: method,
        },
      }
    }

    if (method === 'workspace.update') {
      const params = yield* decodeParams(
        Schema.Struct({
          workspace_id: WorkspaceId,
          name: UpdateWorkspacePayload.fields.name,
          kind: UpdateWorkspacePayload.fields.kind,
          uri: UpdateWorkspacePayload.fields.uri,
          default_branch: UpdateWorkspacePayload.fields.default_branch,
          metadata: UpdateWorkspacePayload.fields.metadata,
        }),
        paramsValue,
        id,
      )
      return {
        id,
        expects_response: expectsResponse,
        request: {
          method: 'PATCH',
          path: `/v1/workspaces/${encodeSegment(params.workspace_id)}`,
          body: {
            name: params.name,
            kind: params.kind,
            uri: params.uri,
            default_branch: Option.getOrNull(params.default_branch),
            metadata: params.metadata,
          },
          label: method,
        },
      }
    }

    if (method === 'workspace.archive') {
      const params = yield* decodeParams(
        Schema.Struct({ workspace_id: WorkspaceId }),
        paramsValue,
        id,
      )
      return {
        id,
        expects_response: expectsResponse,
        request: {
          method: 'POST',
          path: `/v1/workspaces/${encodeSegment(params.workspace_id)}/archive`,
          label: method,
        },
      }
    }

    if (method === 'work.create') {
      const body = yield* validatedBody(CreateWorkPayload, paramsValue, id)
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
        paramsValue,
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
        paramsValue,
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

    if (method === 'work.publish_event') {
      const params = yield* decodeParams(
        Schema.Struct({
          work_id: WorkId,
          type: PublishWorkEventPayload.fields.type,
          data: PublishWorkEventPayload.fields.data,
        }),
        paramsValue,
        id,
      )
      return {
        id,
        expects_response: expectsResponse,
        request: {
          method: 'POST',
          path: `/v1/work/${encodeSegment(params.work_id)}/events`,
          body: { type: params.type, data: params.data },
          label: method,
        },
      }
    }

    if (method === 'lease.request') {
      const body = yield* validatedBody(RequestLeasePayload, paramsValue, id)
      return {
        id,
        expects_response: expectsResponse,
        request: { method: 'POST', path: '/v1/leases', body, label: method },
      }
    }

    if (method === 'lease.release') {
      const params = yield* decodeParams(
        Schema.Struct({ lease_id: LeaseId }),
        paramsValue,
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
      const body = yield* validatedBody(CreateArtifactPayload, paramsValue, id)
      return {
        id,
        expects_response: expectsResponse,
        request: { method: 'POST', path: '/v1/artifacts', body, label: method },
      }
    }

    if (method === 'artifact.delete') {
      const params = yield* decodeParams(
        Schema.Struct({ artifact_id: ArtifactId }),
        paramsValue,
        id,
      )
      return {
        id,
        expects_response: expectsResponse,
        request: {
          method: 'DELETE',
          path: `/v1/artifacts/${encodeSegment(params.artifact_id)}`,
          label: method,
        },
      }
    }

    if (method === 'checkpoint.create') {
      const body = yield* validatedBody(
        CreateCheckpointPayload,
        paramsValue,
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
      const body = yield* validatedBody(RequestReviewPayload, paramsValue, id)
      return {
        id,
        expects_response: expectsResponse,
        request: { method: 'POST', path: '/v1/reviews', body, label: method },
      }
    }

    if (method === 'review.approve') {
      const params = yield* decodeParams(
        Schema.Struct({
          review_id: ReviewId,
          met_requirements: ApproveReviewPayload.fields.met_requirements,
        }),
        paramsValue,
        id,
      )
      return {
        id,
        expects_response: expectsResponse,
        request: {
          method: 'POST',
          path: `/v1/reviews/${encodeSegment(params.review_id)}/approve`,
          body: { met_requirements: params.met_requirements },
          label: method,
        },
      }
    }

    if (method === 'review.reject') {
      const params = yield* decodeParams(
        Schema.Struct({ review_id: ReviewId }),
        paramsValue,
        id,
      )
      return {
        id,
        expects_response: expectsResponse,
        request: {
          method: 'POST',
          path: `/v1/reviews/${encodeSegment(params.review_id)}/reject`,
          label: method,
        },
      }
    }

    if (method === 'review.request_changes') {
      const params = yield* decodeParams(
        Schema.Struct({ review_id: ReviewId }),
        paramsValue,
        id,
      )
      return {
        id,
        expects_response: expectsResponse,
        request: {
          method: 'POST',
          path: `/v1/reviews/${encodeSegment(params.review_id)}/request_changes`,
          label: method,
        },
      }
    }

    const params = yield* decodeParams(EventsStreamParams, paramsValue, id)
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
