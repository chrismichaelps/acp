/** @Acp.Infra.JsonRpc.ResumeCommands — work-scoped read method mappings */
import { Either, Option, Schema } from 'effect'
import { WorkId } from '../../protocol/schema/index.js'
import { decodeParams, encodeSegment } from './json-rpc-command-support.js'
import type {
  JsonRpcCommand,
  JsonRpcId,
  JsonRpcMethod,
  JsonRpcRequestError,
} from './json-rpc-command-support.js'

export const resumeMethodLabels = [
  'work.get',
  'checkpoint.list_for_work',
  'checkpoint.latest_for_work',
  'artifact.list_for_work',
] as const

const WorkResumeParams = Schema.Struct({ work_id: WorkId })

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

  return Option.none()
}
