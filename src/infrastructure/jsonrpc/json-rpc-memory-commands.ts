/** @Acp.Infra.JsonRpc.MemoryCommands — workspace memory method mappings */
import { Either, Option, Schema } from 'effect'
import {
  CreateMemoryPayload,
  MemoryKind,
  WorkId,
  WorkspaceId,
} from '../../protocol/schema/index.js'
import { decodeParams, validatedBody } from './json-rpc-command-support.js'
import type {
  JsonRpcCommand,
  JsonRpcId,
  JsonRpcMethod,
  JsonRpcRequestError,
} from './json-rpc-command-support.js'

export const memoryMethodLabels = ['memory.create', 'memory.list'] as const

// JSON-RPC params arrive as decoded JSON (numbers are numbers), so this mirrors
// the GET /v1/memory query without NumberFromString — the route re-decodes the
// rendered query string through MemoryListParams.
const MemoryListParams = Schema.Struct({
  workspace_id: WorkspaceId,
  after_seq: Schema.optional(Schema.Number),
  limit: Schema.optional(Schema.Number),
  work_id: Schema.optional(WorkId),
  kind: Schema.optional(MemoryKind),
  key: Schema.optional(Schema.NonEmptyString),
  label: Schema.optional(Schema.String),
})

const renderQuery = (params: typeof MemoryListParams.Type): string =>
  (
    [
      ['workspace_id', params.workspace_id],
      ['after_seq', params.after_seq?.toString()],
      ['limit', params.limit?.toString()],
      ['work_id', params.work_id],
      ['kind', params.kind],
      ['key', params.key],
      ['label', params.label],
    ] as readonly (readonly [string, string | undefined])[]
  )
    .filter((pair): pair is readonly [string, string] => pair[1] !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&')

export const commandForMemory = (
  method: JsonRpcMethod,
  paramsValue: Option.Option<unknown>,
  id: Option.Option<JsonRpcId>,
  expectsResponse: boolean,
): Option.Option<Either.Either<JsonRpcCommand, JsonRpcRequestError>> => {
  if (method === 'memory.create') {
    return Option.some(
      Either.map(
        validatedBody(CreateMemoryPayload, paramsValue, id),
        (body) => ({
          id,
          expects_response: expectsResponse,
          request: { method: 'POST', path: '/v1/memory', body, label: method },
        }),
      ),
    )
  }

  if (method === 'memory.list') {
    return Option.some(
      Either.map(decodeParams(MemoryListParams, paramsValue, id), (params) => ({
        id,
        expects_response: expectsResponse,
        request: {
          method: 'GET',
          path: `/v1/memory?${renderQuery(params)}`,
          label: method,
        },
      })),
    )
  }

  return Option.none()
}
