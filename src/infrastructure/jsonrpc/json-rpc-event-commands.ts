/** @Acp.Infra.JsonRpc.EventCommands — event replay and stream mappings */
import { Either, Option, Schema } from 'effect'
import { EventsReplayParams } from '../http/index.js'
import { WorkspaceId } from '../../protocol/schema/index.js'
import { decodeParams } from './json-rpc-command-support.js'
import type {
  JsonRpcCommand,
  JsonRpcId,
  JsonRpcMethod,
  JsonRpcRequestError,
} from './json-rpc-command-support.js'

export const eventMethodLabels = ['events.list', 'events.subscribe'] as const

const SubscribeParams = Schema.Struct({ workspace_id: WorkspaceId })

const command = (
  id: Option.Option<JsonRpcId>,
  expectsResponse: boolean,
  method: JsonRpcMethod,
  path: string,
  stream = false,
): JsonRpcCommand => ({
  id,
  expects_response: expectsResponse,
  request: {
    method: 'GET',
    path,
    label: method,
    ...(stream ? { stream } : {}),
  },
})

export const commandForEvent = (
  method: JsonRpcMethod,
  paramsValue: Option.Option<unknown>,
  id: Option.Option<JsonRpcId>,
  expectsResponse: boolean,
): Option.Option<Either.Either<JsonRpcCommand, JsonRpcRequestError>> => {
  if (method === 'events.list') {
    return Option.some(
      Either.map(decodeParams(EventsReplayParams, paramsValue, id), (params) =>
        command(
          id,
          expectsResponse,
          method,
          `/v1/events?workspace_id=${encodeURIComponent(params.workspace_id)}&after_seq=${params.after_seq.toString()}`,
        ),
      ),
    )
  }

  if (method === 'events.subscribe') {
    return Option.some(
      Either.map(decodeParams(SubscribeParams, paramsValue, id), (params) =>
        command(
          id,
          expectsResponse,
          method,
          `/v1/events/stream?workspace_id=${encodeURIComponent(params.workspace_id)}`,
          true,
        ),
      ),
    )
  }

  return Option.none()
}
