/** @Acp.Infra.JsonRpc.WorkerCommands — host-scoped worker read mappings */
import { Either, Option, Schema } from 'effect'
import { WorkerId } from '../../protocol/schema/index.js'
import { decodeParams, encodeSegment } from './json-rpc-command-support.js'
import type {
  JsonRpcCommand,
  JsonRpcId,
  JsonRpcMethod,
  JsonRpcRequestError,
} from './json-rpc-command-support.js'

export const workerMethodLabels = ['worker.list', 'worker.get'] as const

const WorkerParams = Schema.Struct({ worker_id: WorkerId })

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

export const commandForWorker = (
  method: JsonRpcMethod,
  paramsValue: Option.Option<unknown>,
  id: Option.Option<JsonRpcId>,
  expectsResponse: boolean,
): Option.Option<Either.Either<JsonRpcCommand, JsonRpcRequestError>> => {
  if (method === 'worker.list') {
    return Option.some(
      Either.right(command(id, expectsResponse, method, '/v1/workers')),
    )
  }

  if (method === 'worker.get') {
    return Option.some(
      Either.map(decodeParams(WorkerParams, paramsValue, id), (params) =>
        command(
          id,
          expectsResponse,
          method,
          `/v1/workers/${encodeSegment(params.worker_id)}`,
        ),
      ),
    )
  }

  return Option.none()
}
