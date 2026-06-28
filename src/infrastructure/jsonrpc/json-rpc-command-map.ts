/** @Acp.Infra.JsonRpc.CommandMap — JSON-RPC methods to ACP HTTP commands */
import { Either, Option, Schema } from 'effect'
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
  UpdateArtifactPayload,
  WorkId,
  CreateWorkspacePayload,
  UpdateWorkspacePayload,
  WorkspaceId,
} from '../../protocol/schema/index.js'
import {
  decodeParams,
  encodeSegment,
  methodNotFound,
  validatedBody,
} from './json-rpc-command-support.js'
import {
  commandForResume,
  resumeMethodLabels,
} from './json-rpc-resume-commands.js'
import type {
  JsonRpcCommand,
  JsonRpcId,
  JsonRpcMethod,
  JsonRpcRequestError,
} from './json-rpc-command-support.js'

export {
  JsonRpcErrorCode,
  JsonRpcId,
  JsonRpcRequestError,
} from './json-rpc-command-support.js'
export type {
  JsonRpcCommand,
  JsonRpcErrorObject,
  JsonRpcErrorResponse,
  JsonRpcHttpRequest,
  JsonRpcMethod,
  JsonRpcResponse,
  JsonRpcSuccessResponse,
} from './json-rpc-command-support.js'

const methodLabels = new Set<string>([
  'session.initialize',
  'workspace.list',
  'workspace.create',
  'workspace.update',
  'workspace.archive',
  ...resumeMethodLabels,
  'work.create',
  'work.claim',
  'work.update',
  'work.publish_event',
  'lease.request',
  'lease.release',
  'artifact.create',
  'artifact.update',
  'artifact.delete',
  'checkpoint.create',
  'review.request',
  'review.approve',
  'review.reject',
  'review.request_changes',
  'events.subscribe',
])

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
    const resumeCommand = commandForResume(
      method,
      paramsValue,
      id,
      expectsResponse,
    )
    if (Option.isSome(resumeCommand)) {
      return yield* resumeCommand.value
    }

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

    if (method === 'artifact.update') {
      const params = yield* decodeParams(
        Schema.Struct({
          artifact_id: ArtifactId,
          kind: UpdateArtifactPayload.fields.kind,
          uri: UpdateArtifactPayload.fields.uri,
          media_type: UpdateArtifactPayload.fields.media_type,
          summary: UpdateArtifactPayload.fields.summary,
          content: UpdateArtifactPayload.fields.content,
        }),
        paramsValue,
        id,
      )
      return {
        id,
        expects_response: expectsResponse,
        request: {
          method: 'PATCH',
          path: `/v1/artifacts/${encodeSegment(params.artifact_id)}`,
          body: {
            kind: params.kind,
            uri: Option.getOrNull(params.uri),
            media_type: Option.getOrNull(params.media_type),
            summary: Option.getOrNull(params.summary),
            content: Option.getOrNull(params.content),
          },
          label: method,
        },
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
