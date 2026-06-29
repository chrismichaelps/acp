/** @Acp.Infra.JsonRpc.ResumeCommands — work-scoped read method mappings */
import { Either, Option, Schema } from 'effect'
import { ArtifactId, WorkId, WorkspaceId } from '../../protocol/schema/index.js'
import { decodeParams, encodeSegment } from './json-rpc-command-support.js'
import type {
  JsonRpcCommand,
  JsonRpcId,
  JsonRpcMethod,
  JsonRpcRequestError,
} from './json-rpc-command-support.js'

export const resumeMethodLabels = [
  'work.get',
  'work.list_for_workspace',
  'checkpoint.list_for_work',
  'checkpoint.list_for_workspace',
  'checkpoint.latest_for_work',
  'artifact.list_for_work',
  'artifact.list_for_workspace',
  'artifact.read_content',
  'review.list_for_work',
  'review.list_for_workspace',
] as const

const WorkResumeParams = Schema.Struct({ work_id: WorkId })
const WorkspaceWorkParams = Schema.Struct({ workspace_id: WorkspaceId })
const ArtifactContentParams = Schema.Struct({ artifact_id: ArtifactId })

const command = (
  id: Option.Option<JsonRpcId>,
  expectsResponse: boolean,
  method: JsonRpcMethod,
  path: string,
): JsonRpcCommand => ({
  id,
  expects_response: expectsResponse,
  request: { method: 'GET', path, label: method },
})

export const commandForResume = (
  method: JsonRpcMethod,
  paramsValue: Option.Option<unknown>,
  id: Option.Option<JsonRpcId>,
  expectsResponse: boolean,
): Option.Option<Either.Either<JsonRpcCommand, JsonRpcRequestError>> => {
  if (method === 'work.get') {
    return Option.some(
      Either.map(decodeParams(WorkResumeParams, paramsValue, id), (params) =>
        command(
          id,
          expectsResponse,
          method,
          `/v1/work/${encodeSegment(params.work_id)}`,
        ),
      ),
    )
  }

  if (method === 'work.list_for_workspace') {
    return Option.some(
      Either.map(decodeParams(WorkspaceWorkParams, paramsValue, id), (params) =>
        command(
          id,
          expectsResponse,
          method,
          `/v1/workspaces/${encodeSegment(params.workspace_id)}/work`,
        ),
      ),
    )
  }

  if (method === 'checkpoint.list_for_work') {
    return Option.some(
      Either.map(decodeParams(WorkResumeParams, paramsValue, id), (params) =>
        command(
          id,
          expectsResponse,
          method,
          `/v1/work/${encodeSegment(params.work_id)}/checkpoints`,
        ),
      ),
    )
  }

  if (method === 'checkpoint.list_for_workspace') {
    return Option.some(
      Either.map(decodeParams(WorkspaceWorkParams, paramsValue, id), (params) =>
        command(
          id,
          expectsResponse,
          method,
          `/v1/workspaces/${encodeSegment(params.workspace_id)}/checkpoints`,
        ),
      ),
    )
  }

  if (method === 'checkpoint.latest_for_work') {
    return Option.some(
      Either.map(decodeParams(WorkResumeParams, paramsValue, id), (params) =>
        command(
          id,
          expectsResponse,
          method,
          `/v1/work/${encodeSegment(params.work_id)}/checkpoints/latest`,
        ),
      ),
    )
  }

  if (method === 'artifact.list_for_work') {
    return Option.some(
      Either.map(decodeParams(WorkResumeParams, paramsValue, id), (params) =>
        command(
          id,
          expectsResponse,
          method,
          `/v1/work/${encodeSegment(params.work_id)}/artifacts`,
        ),
      ),
    )
  }

  if (method === 'artifact.list_for_workspace') {
    return Option.some(
      Either.map(decodeParams(WorkspaceWorkParams, paramsValue, id), (params) =>
        command(
          id,
          expectsResponse,
          method,
          `/v1/workspaces/${encodeSegment(params.workspace_id)}/artifacts`,
        ),
      ),
    )
  }

  if (method === 'artifact.read_content') {
    return Option.some(
      Either.map(
        decodeParams(ArtifactContentParams, paramsValue, id),
        (params) =>
          command(
            id,
            expectsResponse,
            method,
            `/v1/artifacts/${encodeSegment(params.artifact_id)}/content`,
          ),
      ),
    )
  }

  if (method === 'review.list_for_work') {
    return Option.some(
      Either.map(decodeParams(WorkResumeParams, paramsValue, id), (params) =>
        command(
          id,
          expectsResponse,
          method,
          `/v1/work/${encodeSegment(params.work_id)}/reviews`,
        ),
      ),
    )
  }

  if (method === 'review.list_for_workspace') {
    return Option.some(
      Either.map(decodeParams(WorkspaceWorkParams, paramsValue, id), (params) =>
        command(
          id,
          expectsResponse,
          method,
          `/v1/workspaces/${encodeSegment(params.workspace_id)}/reviews`,
        ),
      ),
    )
  }

  return Option.none()
}
